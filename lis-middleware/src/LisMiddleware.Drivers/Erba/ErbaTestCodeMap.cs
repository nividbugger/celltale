namespace LisMiddleware.Drivers.Erba;

/// <summary>
/// Maps between neutral TestCode names and Erba XL-200 chemistry analyzer test codes.
///
/// The Erba XL-200 is a clinical chemistry analyzer (not hematology).
/// Test codes cover liver function, kidney function, lipid panel, glucose,
/// electrolytes, proteins, and other chemistry assays.
///
/// TODO(manual): Verify every entry against the EXACT code string the XL-200 writes
/// into R record field 3. Capture a raw TCP frame from the service logs (Debug level)
/// and confirm each code. Source required: "Erba XL-200 Host/LIS Interface Specification"
/// (e.g. Ref RAA066AEN or the Erba XL ASTM HOST Manual).
/// </summary>
public static class ErbaTestCodeMap
{
    // Key = neutral code, Value = Erba XL-200 code.
    // Codes confirmed from Erba MultXL v2025.01B [XL-200] TLS patient screen (photo, 2026-07-18).
    private static readonly Dictionary<string, string> NeutralToErba = new(StringComparer.OrdinalIgnoreCase)
    {
        // Glucose
        { "GLU",    "GLU"    },  // Glucose
        // Kidney function
        { "UREA",   "UREA"   },  // Urea
        { "CREA",   "CRENZ"  },  // Creatinine (enzymatic method) — CRENZ on XL-200
        { "CRENZ",  "CRENZ"  },  // Creatinine enzymatic (direct by neutral name)
        { "CRE",    "CRE"    },  // Creatinine (Jaffe method variant)
        { "UA",     "UA"     },  // Uric Acid
        // Liver function
        { "ALT",    "SGPTD"  },  // ALT / SGPT (Direct method = SGPTD)
        { "AST",    "SGOTD"  },  // AST / SGOT (Direct method = SGOTD)
        { "ALP",    "ALPU"   },  // Alkaline Phosphatase = ALPU
        { "GGT",    "GGT"    },  // Gamma-Glutamyl Transferase
        { "TBIL",   "BIT"    },  // Total Bilirubin = BIT
        { "DBIL",   "BIDD"   },  // Direct Bilirubin = BIDD
        { "TP",     "PRO"    },  // Total Protein = PRO
        { "ALB",    "ALBD"   },  // Albumin Direct = ALBD
        // Lipids
        { "CHOL",   "CHOL"   },  // Total Cholesterol
        { "TRIG",   "TRIG"   },  // Triglycerides
        { "HDL",    "HDLCD"  },  // HDL Cholesterol Direct = HDLCD
        { "LDL",    "LDL"    },  // LDL Cholesterol
        // HbA1c
        { "HBA1C",  "HA1cD"  },  // HbA1c Direct = HA1cD
        { "HA1CD",  "HA1cD"  },
        // Enzymes
        { "AMY",    "AMY"    },  // Amylase
        { "CK",     "CKNac"  },  // CK (NAC method) = CKNac
        { "CKMB",   "CKMbD"  },  // CK-MB Direct = CKMbD
        { "ADA",    "ADA"    },  // Adenosine Deaminase
        // Minerals & electrolytes
        { "CA",     "CA"     },  // Calcium
        { "CO2",    "CO2"    },  // Carbon Dioxide / Bicarbonate
        // Inflammation
        { "CRP",    "CRP"    },  // C-Reactive Protein
        { "CRPD",   "CRPD"   },  // CRP Direct/quantitative
        { "CRPHS",  "CRPHS"  },  // CRP High Sensitivity
        { "ASO",    "ASO"    },  // Antistreptolysin O
        // Iron studies
        { "FE",     "FE"     },  // Iron
        { "FERR",   "FERR"   },  // Ferritin
        // Apolipoproteins
        { "APOA1",  "APOA1"  },  // Apolipoprotein A1
        { "APOB",   "APOB"   },  // Apolipoprotein B
    };

    // Multiple neutral codes may map to the same Erba code (e.g. CREA + CRENZ → CRENZ).
    // Keep the first-encountered mapping so ToNeutral always returns a stable neutral name.
    private static readonly Dictionary<string, string> ErbaToNeutral = BuildReverse();

    private static Dictionary<string, string> BuildReverse()
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in NeutralToErba)
            d.TryAdd(kv.Value, kv.Key);
        return d;
    }

    /// <summary>Convert a neutral code to the Erba XL-200 code for O record transmission.</summary>
    public static string ToErba(string neutralCode)
        => NeutralToErba.TryGetValue(neutralCode, out var code)
            ? code
            : neutralCode; // pass through unknown rather than throw

    /// <summary>Convert an Erba XL-200 R record test code to neutral internal name.</summary>
    public static string ToNeutral(string erbaCode)
        => ErbaToNeutral.TryGetValue(erbaCode, out var code)
            ? code
            : erbaCode;
}
