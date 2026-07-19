using LisMiddleware.Astm;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;
using System.Text;

namespace LisMiddleware.Drivers.Erba;

/// <summary>
/// Driver for the Erba XL-200 clinical chemistry analyzer.
///
/// Field positions and protocol rules sourced from:
///   "Transasia Bio-Medicals EM 200 (Clinical Chemistry Analyzer)
///    ASTM Host Interface Document, Version 2.0" (Nov 2008).
/// The EM 200 and XL-200 share the same chemistry-analyzer ASTM implementation.
///
/// Standards: E1381-02 (transport), E1394-97 (records).
///
/// Key Erba-specific deviations from the ASTM default:
///   - Repeat delimiter is BACKTICK (`) not backslash.
///   - Q record field 3: Starting Range ID = "^{SampleId}" — sample ID at component 1.
///   - R record field 3: Universal Test ID = "^^^{Code}" — test code at component 3.
///   - O record field 5: test list = "^^^{Code1}`^^^{Code2}" with backtick separator.
///   - P record has NO age field — birthdate (field 8, yyyyMMdd) is the only demographic date.
///   - H record delimiter field (field 2) = "`^&" (backtick, caret, ampersand).
///
/// TODO(manual): verify masked-value error strings (currently assumed ---- / ++++) against
///               the specific XL-200 firmware in the field.
/// </summary>
public sealed class ErbaDriver : IAnalyzerDriver
{
    private readonly ILogger<ErbaDriver> _log;

    // Erba repeat delimiter (backtick) — used in O record test lists and H field 2.
    private const char  RepeatSep     = '`';

    // ── Q record (query from analyzer after barcode scan) ────────────────────
    // Field 3 (index 2): Starting Range ID = "^{SampleId}"
    // Example frame:  Q|1|^10006122|||S|||||||O
    private const int   Q_Field       = 2;  // field 3 (0-based)
    private const int   Q_SampleComp  = 1;  // component 1 within field 3 is the sample ID

    // ── P record (patient demographics — bidirectional) ──────────────────────
    // Source: EM 200 host interface doc, section P record.
    private const int   P_PatientId   = 2;  // field 3: Practice-assigned Patient ID
    private const int   P_Name        = 5;  // field 6: Patient Name "Last^First^Middle^Title"
    private const int   P_Dob         = 7;  // field 8: BirthDate (yyyyMMdd) — NO age field exists
    private const int   P_Sex         = 8;  // field 9: M / F / U

    // ── O record (test order — LIS→analyzer direction) ───────────────────────
    private const int   O_SampleId    = 2;  // field 3: Specimen ID
    private const int   O_Tests       = 4;  // field 5: Universal Test IDs "^^^CODE`^^^CODE"
    // field 12 (index 11) = Action Code N/A/C
    // field 26 (index 25) = Report Type O/Q/F/Z/Y (see spec)

    // ── R record (results from analyzer) ─────────────────────────────────────
    private const int   R_TestId      = 2;  // field 3: Universal Test ID "^^^CODE"
    private const int   R_CodeComp    = 3;  // component 3 within field 3 = test code
    private const int   R_Value       = 3;  // field 4: measurement value
    private const int   R_Unit        = 4;  // field 5: units (ISO 2955)
    private const int   R_Flag        = 6;  // field 7: abnormal flag N/A/H/L/HH/LL
    private const int   R_DateTime    = 12; // field 13: Date/Time test completed yyyyMMddHHmmss

    // TODO(manual): verify these masked-value strings against the XL-200 firmware
    private const string MaskAnalysisError = "----";
    private const string MaskOutOfRange    = "++++";

    public string AnalyzerId => "erba";

    public ErbaDriver(ILogger<ErbaDriver> log) => _log = log;

    // ── Message classification ────────────────────────────────────────────────

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

    // ── Flow 1 inbound: parse barcode-scan query ──────────────────────────────

    public SampleQuery ParseQuery(AstmMessage message)
    {
        string? qRecord = message.Records.FirstOrDefault(r => AstmRecord.RecordType(r) == "Q");
        if (qRecord == null)
            throw new InvalidOperationException("Erba: query message has no Q record");

        // Q field 3 (index 2) = "^{SampleId}" — component 1 holds the sample ID.
        // Example: Q|1|^10006122|||S|||||||O  → field = "^10006122" → component 1 = "10006122"
        string rangeField = AstmRecord.Field(qRecord, Q_Field);
        string sampleId   = AstmRecord.Component(rangeField, Q_SampleComp).Trim();

        if (string.IsNullOrEmpty(sampleId))
            throw new InvalidOperationException(
                $"Erba: could not extract sample ID from Q field 3: '{rangeField}'");

        _log.LogDebug("Erba query: sampleId={SampleId}", sampleId);
        return new SampleQuery(sampleId, AnalyzerId);
    }

    // ── Flow 2 inbound: parse result message ─────────────────────────────────

    public ResultSet ParseResults(AstmMessage message)
    {
        string? pRecord = message.Records.FirstOrDefault(r => AstmRecord.RecordType(r) == "P");
        string? oRecord = message.Records.FirstOrDefault(r => AstmRecord.RecordType(r) == "O");

        // Specimen ID sits in O field 3 (index 2); may be "SampleID^Container" — take component 0
        string sampleId = oRecord != null
            ? AstmRecord.Component(AstmRecord.Field(oRecord, O_SampleId), 0)
            : "UNKNOWN";

        Patient? patient = pRecord != null ? ParsePatient(pRecord) : null;

        var results = new List<Result>();
        foreach (string r in message.Records.Where(r => AstmRecord.RecordType(r) == "R"))
            results.Add(ParseRRecord(r));

        DateTimeOffset runTime = results.Count > 0
            ? results.Max(r => r.CompletedAt)
            : DateTimeOffset.UtcNow;

        return new ResultSet(sampleId, AnalyzerId, patient, results.AsReadOnly(), runTime);
    }

    private Patient ParsePatient(string pRecord)
    {
        string patientId = AstmRecord.Field(pRecord, P_PatientId);
        string nameField = AstmRecord.Field(pRecord, P_Name);
        string lastName  = AstmRecord.Component(nameField, 0);
        string firstName = AstmRecord.Component(nameField, 1);
        string name      = string.IsNullOrEmpty(firstName)
            ? lastName
            : $"{firstName} {lastName}".Trim();
        string dobRaw = AstmRecord.Field(pRecord, P_Dob);
        string sex    = AstmRecord.Field(pRecord, P_Sex);

        // P record has no age field — compute age from DOB if available
        DateOnly? dob = TryParseDate(dobRaw);
        int? age = dob.HasValue
            ? ComputeAge(dob.Value)
            : null;

        return new Patient(patientId, name, age, sex, dob);
    }

    private Result ParseRRecord(string rRecord)
    {
        // R field 3 (index 2) = "^^^{Code}" — code is at component 3 (0-based)
        // Example: R|1|^^^LDH|321|U/L|||N|F||||20080605120000
        string testIdField = AstmRecord.Field(rRecord, R_TestId);
        string testCodeRaw = AstmRecord.Component(testIdField, R_CodeComp);
        string testCode    = ErbaTestCodeMap.ToNeutral(testCodeRaw);

        string valueRaw = AstmRecord.Field(rRecord, R_Value);
        string unit     = AstmRecord.Field(rRecord, R_Unit);
        string flagRaw  = AstmRecord.Field(rRecord, R_Flag);
        string dateRaw  = AstmRecord.Field(rRecord, R_DateTime);

        ResultFlag flag  = ParseFlag(valueRaw, flagRaw);
        string? value    = flag is ResultFlag.AnalysisError or ResultFlag.OutOfRange ? null : valueRaw;
        DateTimeOffset at = TryParseDateTime(dateRaw) ?? DateTimeOffset.UtcNow;

        return new Result(testCode, value, unit, flag, at);
    }

    private static ResultFlag ParseFlag(string value, string flagField)
    {
        // TODO(manual): confirm masked-value strings against XL-200 firmware
        if (value == MaskAnalysisError) return ResultFlag.AnalysisError;
        if (value == MaskOutOfRange)    return ResultFlag.OutOfRange;
        return flagField is "N" or "" ? ResultFlag.Normal : ResultFlag.Abnormal;
    }

    // ── Flow 1 outbound: serialize LIS response back to analyzer ─────────────

    public AstmMessage SerializeOrderResponse(OrderResponse response)
    {
        var records = new List<string>
        {
            BuildHRecord(),
            BuildPRecord(response.Patient, response.SampleId),
            BuildORecord(response.SampleId, response.OrderedTests, reportType: "Q"),
            "L|1|N"
        };
        return new Core.Models.AstmMessage(records.AsReadOnly());
    }

    public AstmMessage SerializeNoOrderResponse(string sampleId)
    {
        // Report type Z = "no record of this patient" (per ASTM E1394-97 O field 26)
        var records = new List<string>
        {
            BuildHRecord(),
            BuildORecord(sampleId, [], reportType: "Z"),
            "L|1|N"
        };
        return new Core.Models.AstmMessage(records.AsReadOnly());
    }

    // ── Private record builders ───────────────────────────────────────────────

    private static string BuildHRecord()
    {
        // Erba H field 2 delimiter definition: "`^&" (backtick=repeat, ^=component, &=escape)
        // Field 12 = Processing ID "P", Field 13 = Version "E 1394-97", Field 14 = datetime
        string ts = DateTime.Now.ToString("yyyyMMddHHmmss");
        var sb = new StringBuilder();
        sb.Append("H|`^&"); // fields 1 + 2
        // fields 3-11: empty (8 separators)
        sb.Append("||||||||");
        // field 12: processing ID
        sb.Append("|P");
        // field 13: version
        sb.Append("|E 1394-97");
        // field 14: datetime
        sb.Append('|').Append(ts);
        return sb.ToString();
    }

    private static string BuildPRecord(Patient? patient, string sampleId)
    {
        if (patient == null)
            return $"P|1|{sampleId}";

        // Name: "Last^First" — put full name in last-name slot (Erba displays it as-is)
        string namePart = patient.Name.ToUpperInvariant();

        // Birthdate required (no age field in P record per ASTM E1394 / EM 200 doc)
        string dob = patient.DateOfBirth?.ToString("yyyyMMdd") ?? "";

        // If no DOB but age is known, derive approximate DOB (1 Jan of birth year)
        // Document the approximation per spec guidance
        if (string.IsNullOrEmpty(dob) && patient.Age.HasValue)
            dob = $"{DateTime.Now.Year - patient.Age.Value}0101"; // approximate

        string sex = MapSex(patient.Sex);

        // Build: P|seq|patientId|||name||dob|sex
        // (fields 3,4,5 = patient IDs; field 6 = name; field 7 = empty; field 8 = dob; field 9 = sex)
        var sb = new StringBuilder();
        sb.Append("P|1|")
          .Append(patient.PatientId)  // field 3: practice patient ID
          .Append("|||")             // fields 4,5: lab patient ID, patient ID 3 (empty)
          .Append(namePart)          // field 6: name
          .Append("||")             // field 7: mother's maiden name (empty)
          .Append(dob)               // field 8: birthdate
          .Append('|')
          .Append(sex);              // field 9: sex
        return sb.ToString();
    }

    private static string BuildORecord(
        string sampleId,
        IReadOnlyList<OrderedTest> tests,
        string reportType)
    {
        // Test list: "^^^CODE1`^^^CODE2`^^^CODE3" (backtick repeat separator)
        string testList = tests.Count > 0
            ? string.Join(RepeatSep, tests.Select(t => $"^^^{ErbaTestCodeMap.ToErba(t.TestCode)}"))
            : "";

        // O record layout up to field 26 (Report Type):
        // Field  3 (index 2): Specimen ID
        // Field  5 (index 4): Universal Test ID list
        // Field  6 (index 5): Priority = R (routine)
        // Field 12 (index 11): Action Code = N (new)
        // Field 26 (index 25): Report Type = Q (query response) / Z (no patient) / Y (no order)
        var sb = new StringBuilder();
        sb.Append("O|1|")
          .Append(sampleId)   // field 3
          .Append("||")       // field 4 (instrument specimen ID, empty)
          .Append(testList)   // field 5
          .Append("|R")       // field 6: routine priority
          // fields 7-11: empty (5 separators)
          .Append("|||||")
          .Append("|N")       // field 12: action code N = new
          // fields 13-25: empty (13 separators)
          .Append("|||||||||||||")
          .Append('|')
          .Append(reportType); // field 26: report type
        return sb.ToString();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string MapSex(string? sex) =>
        sex?.ToUpperInvariant() switch
        {
            "M" or "MALE"   => "M",
            "F" or "FEMALE" => "F",
            _               => "U"
        };

    private static int ComputeAge(DateOnly dob)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        int age = today.Year - dob.Year;
        if (new DateOnly(today.Year, dob.Month, dob.Day) > today) age--;
        return age;
    }

    private static DateOnly? TryParseDate(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        // Accept yyyyMMdd or yyyyMMddHHmmss (use only the date portion)
        string datePart = s.Length >= 8 ? s[..8] : s;
        return DateOnly.TryParseExact(datePart, "yyyyMMdd", out var d) ? d : null;
    }

    private static DateTimeOffset? TryParseDateTime(string s)
        => DateTimeOffset.TryParseExact(s, "yyyyMMddHHmmss",
            null, System.Globalization.DateTimeStyles.AssumeLocal, out var dt) ? dt : null;
}
