using LisMiddleware.Astm;

namespace LisMiddleware.Drivers;

/// <summary>
/// Utility for splitting a raw ASTM record string into fields and components.
/// </summary>
public static class AstmRecord
{
    public static string[] Fields(string record)
        => record.Split(AstmConstants.FieldSep);

    public static string[] Components(string field)
        => field.Split(AstmConstants.ComponentSep);

    public static string Field(string record, int index, string @default = "")
    {
        var fields = Fields(record);
        return index < fields.Length ? fields[index] : @default;
    }

    public static string Component(string field, int index, string @default = "")
    {
        var components = Components(field);
        return index < components.Length ? components[index] : @default;
    }

    public static string RecordType(string record) => Field(record, 0);

    /// <summary>Build a record string from fields (null fields become empty).</summary>
    public static string Build(params string?[] fields)
        => string.Join(AstmConstants.FieldSep, fields.Select(f => f ?? ""));
}
