namespace LisMiddleware.Queue;

public sealed class QueueOptions
{
    public string ResultQueuePath { get; set; } = @"C:\ProgramData\LisMiddleware\queue";
    public int RetryCount         { get; set; } = 5;
    public int BackoffSeconds     { get; set; } = 2;
    public int RetryIntervalMs    { get; set; } = 15_000;
}
