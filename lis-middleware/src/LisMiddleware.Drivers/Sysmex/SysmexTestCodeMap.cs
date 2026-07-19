namespace LisMiddleware.Drivers.Sysmex;

/// <summary>
/// Maps between neutral TestCode names and Sysmex XN-330 analysis-parameter codes.
///
/// Source: "XN Series ASTM Host Interface Specifications" ver 10.0 (R311016),
///          analysis-parameter code table.
///
/// The Sysmex parameter codes are the strings the analyzer writes into R record
/// Universal Test ID component 4 (format "^^^^{Code}^^{ResultType}").
/// For the XN-330 the neutral code and the Sysmex code are identical (both use
/// standard hematology abbreviations), so the map is an identity pass-through for
/// the parameters listed below.
///
/// TODO(manual): Review against your specific XN-330 firmware version — Sysmex may
///               add or rename codes in later firmware releases.
/// </summary>
public static class SysmexTestCodeMap
{
    // Source: XN Series ASTM Host Interface Specifications ver 10.0, analysis-parameter table.
    // Neutral code == Sysmex code for all standard XN parameters.
    private static readonly HashSet<string> KnownCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        // CBC core
        "WBC", "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC", "PLT",
        // RBC indices
        "RDW-SD", "RDW-CV",
        // PLT indices
        "PDW", "MPV", "P-LCR", "PCT",
        // 5-part differential (percentage)
        "NEUT%", "LYMPH%", "MONO%", "EO%", "BASO%",
        // 5-part differential (absolute count)
        "NEUT#", "LYMPH#", "MONO#", "EO#", "BASO#",
        // Immature granulocytes
        "IG#", "IG%",
        // Nucleated RBCs
        "NRBC#", "NRBC%",
        // Reticulocytes (available on XN-330 with RET channel)
        "RET#", "RET%", "IRF", "LFR", "MFR", "HFR", "RET-HE",
        // Other XN parameters
        "HPC#", "IPF", "PLT-F",
        // Body fluid mode
        "WBC-BF", "RBC-BF", "MN#", "MN%", "PMN#", "PMN%", "TC-BF#",
    };

    /// <summary>Convert a neutral code to the Sysmex parameter string for the O record.</summary>
    public static string ToSysmex(string neutralCode)
    {
        if (KnownCodes.Contains(neutralCode)) return neutralCode;
        // Unknown neutral code — pass through and log warning upstream
        return neutralCode;
    }

    /// <summary>
    /// Convert a Sysmex parameter code (from R record component 4) to neutral code.
    /// For XN parameters the mapping is identity; unknown codes are passed through.
    /// </summary>
    public static string ToNeutral(string sysmexCode) => sysmexCode;

    public static bool IsKnown(string code) => KnownCodes.Contains(code);
}
