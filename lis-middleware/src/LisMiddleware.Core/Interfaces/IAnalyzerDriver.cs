using LisMiddleware.Core.Models;

namespace LisMiddleware.Core.Interfaces;

/// <summary>
/// Implemented once per analyzer model (Erba, Sysmex).
/// All vendor-specific field positions and code tables live in the implementation.
/// </summary>
public interface IAnalyzerDriver
{
    string AnalyzerId { get; }

    /// <summary>
    /// Inspect the raw ASTM records to decide whether this is a query or a result message.
    /// </summary>
    MessageKind ClassifyMessage(AstmMessage message);

    /// <summary>
    /// Parse a query message (barcode scan) into a SampleQuery.
    /// </summary>
    SampleQuery ParseQuery(AstmMessage message);

    /// <summary>
    /// Parse a result message (run complete) into a ResultSet.
    /// </summary>
    ResultSet ParseResults(AstmMessage message);

    /// <summary>
    /// Serialize an order response into ASTM records to send back to the analyzer.
    /// </summary>
    AstmMessage SerializeOrderResponse(OrderResponse response);

    /// <summary>
    /// Produce the "sample not found / no order" response for this analyzer.
    /// </summary>
    AstmMessage SerializeNoOrderResponse(string sampleId);
}

public enum MessageKind { Query, Results, Unknown }
