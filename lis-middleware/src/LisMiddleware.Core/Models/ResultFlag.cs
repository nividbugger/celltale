namespace LisMiddleware.Core.Models;

public enum ResultFlag
{
    Normal,
    Abnormal,
    AnalysisError,   // e.g. Sysmex "----"
    OutOfRange,      // e.g. Sysmex "++++"
    Unknown
}
