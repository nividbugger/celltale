using LisMiddleware.Astm;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;

namespace LisMiddleware.Drivers.Sysmex;

/// <summary>
/// Driver for the Sysmex XN-330 hematology analyzer.
///
/// Field positions sourced from "XN Series ASTM Host Interface Specifications" ver 10.0
/// (document R311016) and XN-L Series Rev 5 (R315005).
///
/// The XN series supports two inquiry modes:
///   - Real-time sample inquiry: Q record field 3, component 2 = Sample ID
///   - Worklist inquiry: Q record field 3, component 0 = Rack No, component 1 = Rack Position
///
/// R record Universal Test ID format: "^^^^{ParameterCode}^^{ResultType}"
///   Parameter code is at component index 4 (four leading empty components).
///
/// Masked values confirmed from spec:
///   "----" = analysis/hardware error, "++++" = out of measurable range.
///
/// TODO(manual): O record test-code format for LIS→analyzer direction (field 5, component 4)
///               needs confirmation from "Output Setting" section of the XN-series spec.
/// </summary>
public sealed class SysmexDriver : IAnalyzerDriver
{
    private readonly ILogger<SysmexDriver> _log;

    // All indices 0-based. Source: XN Series ASTM Host Interface Specifications ver 10.0.

    // Q record (query from analyzer)
    // Field 3 (index 2): "Rack No.^Rack Position^Sample ID No.^Sample No. Attribute"
    private const int Q_Field       = 2;   // field index of the Starting Range ID
    private const int Q_RackComp    = 0;   // component: Rack No. (worklist mode)
    private const int Q_PosComp     = 1;   // component: Rack Position (worklist mode)
    private const int Q_SampleComp  = 2;   // component: Sample ID No. (real-time mode)

    // P record (patient in both directions)
    private const int P_PatientId   = 4;   // field 5: Patient ID Number
    private const int P_Name        = 5;   // field 6: Patient Name (last^first^...)
    private const int P_Dob         = 7;   // field 8: Birth Date (YYYYMMDD)
    private const int P_Sex         = 8;   // field 9: Patient Sex (M/F/U)

    // O record
    private const int O_SampleId    = 2;   // field 3: Specimen ID
    private const int O_TestCodes   = 4;   // field 5: Universal Test ID

    // R record
    private const int R_UniversalId = 2;   // field 3: Universal Test ID (^^^^Code^^type)
    private const int R_ParamComp   = 4;   // component 4 within field 3 = parameter code
    private const int R_Value       = 3;   // field 4: Data/Measurement Value
    private const int R_Unit        = 4;   // field 5: Units
    private const int R_Flag        = 6;   // field 7: Result Abnormal Flags (L/H/N/A/LL/HH/>/<)
    private const int R_DateTime    = 12;  // field 13: Date/Time Test Completed (yyyyMMddHHmmss)

    // Confirmed from XN Series ASTM spec
    private const string MaskAnalysisError = "----";  // analysis or hardware error
    private const string MaskOutOfRange    = "++++";

    public string AnalyzerId => "sysmex";

    public SysmexDriver(ILogger<SysmexDriver> log) => _log = log;

    public MessageKind ClassifyMessage(AstmMessage message)
    {
        foreach (string record in message.Records)
        {
            string type = AstmRecord.RecordType(record);
            if (type == "Q") return MessageKind.Query;
            if (type == "R") return MessageKind.Results;
        }
        return MessageKind.Unknown;
    }

    public SampleQuery ParseQuery(AstmMessage message)
    {
        string? qRecord = message.Records.FirstOrDefault(r => AstmRecord.RecordType(r) == "Q");
        if (qRecord == null)
            throw new InvalidOperationException("Sysmex: query message has no Q record");

        // Q field 3 (index 2): "RackNo^RackPos^SampleId^Attribute"
        string rangeField = AstmRecord.Field(qRecord, Q_Field);
        string rackRaw    = AstmRecord.Component(rangeField, Q_RackComp);
        string posRaw     = AstmRecord.Component(rangeField, Q_PosComp);
        string sampleId   = AstmRecord.Component(rangeField, Q_SampleComp).Trim();

        string? rackId   = rackRaw.Length > 0 ? rackRaw : null;
        string? position = posRaw.Length  > 0 ? posRaw  : null;

        _log.LogDebug("Sysmex query: sampleId={Id} rack={Rack} pos={Pos}", sampleId, rackId, position);
        return new SampleQuery(sampleId, AnalyzerId, rackId, position);
    }

    public ResultSet ParseResults(AstmMessage message)
    {
        string? pRecord = message.Records.FirstOrDefault(r => AstmRecord.RecordType(r) == "P");
        string? oRecord = message.Records.FirstOrDefault(r => AstmRecord.RecordType(r) == "O");

        string sampleId = oRecord != null ? AstmRecord.Field(oRecord, O_SampleId) : "UNKNOWN";
        Patient? patient = pRecord != null ? ParsePatient(pRecord) : null;

        var results = new List<Result>();
        foreach (string r in message.Records.Where(r => AstmRecord.RecordType(r) == "R"))
            results.Add(ParseRRecord(r));

        var runTime = results.Count > 0 ? results.Max(r => r.CompletedAt) : DateTimeOffset.UtcNow;
        return new ResultSet(sampleId, AnalyzerId, patient, results.AsReadOnly(), runTime);
    }

    private Patient ParsePatient(string pRecord)
    {
        string patientId = AstmRecord.Field(pRecord, P_PatientId);
        string nameField = AstmRecord.Field(pRecord, P_Name);
        string lastName  = AstmRecord.Component(nameField, 0);
        string firstName = AstmRecord.Component(nameField, 1);
        string name      = $"{firstName} {lastName}".Trim();
        string dob       = AstmRecord.Field(pRecord, P_Dob);
        string sex       = AstmRecord.Field(pRecord, P_Sex);

        DateOnly? dateOfBirth = TryParseDate(dob);
        return new Patient(patientId, name, null, sex, dateOfBirth);
    }

    private Result ParseRRecord(string rRecord)
    {
        // Universal Test ID field (index 2) format: "^^^^{Code}^^{ResultType}"
        string universalId = AstmRecord.Field(rRecord, R_UniversalId);
        string paramCode   = AstmRecord.Component(universalId, R_ParamComp);
        string testCode    = SysmexTestCodeMap.ToNeutral(paramCode);
        string valueRaw    = AstmRecord.Field(rRecord, R_Value);
        string unit        = AstmRecord.Field(rRecord, R_Unit);
        string flagRaw     = AstmRecord.Field(rRecord, R_Flag);
        string dateRaw     = AstmRecord.Field(rRecord, R_DateTime);

        var flag = ParseFlag(valueRaw, flagRaw);
        string? value = flag is ResultFlag.AnalysisError or ResultFlag.OutOfRange ? null : valueRaw;
        DateTimeOffset completedAt = TryParseDateTime(dateRaw) ?? DateTimeOffset.UtcNow;

        return new Result(testCode, value, unit, flag, completedAt);
    }

    private static ResultFlag ParseFlag(string value, string flagField)
    {
        if (value == MaskAnalysisError) return ResultFlag.AnalysisError;
        if (value == MaskOutOfRange)    return ResultFlag.OutOfRange;
        if (string.IsNullOrWhiteSpace(flagField) || flagField == "N") return ResultFlag.Normal;
        return ResultFlag.Abnormal;
    }

    public AstmMessage SerializeOrderResponse(OrderResponse response)
    {
        var records = new List<string>
        {
            BuildHRecord("P"),
        };
        if (response.Patient != null) records.Add(BuildPRecord(response.Patient));
        records.Add(BuildORecord(response.SampleId, response.OrderedTests));
        records.Add("L|1|N");
        return new Core.Models.AstmMessage(records.AsReadOnly());
    }

    public AstmMessage SerializeNoOrderResponse(string sampleId)
    {
        // Report type X = "no order found" per XN-series spec
        var records = new List<string>
        {
            BuildHRecord("P"),
            // O record: field 5 (index 4) empty test list, field 26 (index 25) = X
            $"O|1|{sampleId}||||R|||||||||||||||||||||||X",
            "L|1|N"
        };
        return new Core.Models.AstmMessage(records.AsReadOnly());
    }

    private static string BuildHRecord(string processingId)
    {
        string timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
        // H field positions (1-indexed): 1=H, 2=delimiters, 5=sender, 12=processingId, 13=version, 14=datetime
        return AstmRecord.Build(
            "H", @"\^&", null, null, "LIS", null, null, null, null, null, null,
            processingId, "LIS2-A2", timestamp);
    }

    private static string BuildPRecord(Patient p)
    {
        // P field 5 (index 4) = Patient ID, field 6 (index 5) = Name (last^first), field 8 = DOB, field 9 = Sex
        string namePart = $"{p.Name}^";
        string dob      = p.DateOfBirth?.ToString("yyyyMMdd") ?? "";
        // Pad to index 4 for patient ID (fields 1-4: P, seq, practice-id, lab-id)
        return AstmRecord.Build("P", "1", null, null, p.PatientId, namePart, null, dob, p.Sex ?? "");
    }

    private static string BuildORecord(string sampleId, IReadOnlyList<OrderedTest> tests)
    {
        // TODO(manual): confirm O record test-code component format for XN→LIS direction
        // Using "^^^^{Code}" to match the analyzer's own R record format
        string testList = string.Join(@"\", tests.Select(t => $"^^^^{SysmexTestCodeMap.ToSysmex(t.TestCode)}"));
        return AstmRecord.Build("O", "1", sampleId, null, testList, "R");
    }

    private static DateOnly? TryParseDate(string s)
        => DateOnly.TryParseExact(s, "yyyyMMdd", out var d) ? d : null;

    private static DateTimeOffset? TryParseDateTime(string s)
        => DateTimeOffset.TryParseExact(s, "yyyyMMddHHmmss",
            null, System.Globalization.DateTimeStyles.AssumeLocal, out var dt) ? dt : null;
}
