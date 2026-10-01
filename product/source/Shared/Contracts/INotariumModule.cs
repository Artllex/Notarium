using System.Windows;
namespace Notarium.Contracts;

// UI module contract only. No shared data model or storage service is implemented here.
public interface INotariumModule
{
    string Id { get; }
    string DisplayName { get; }
    Window CreateWindow();
}

public sealed record RecentDocument(string Id, string Title, string Location, DateTime LastUsedUtc, bool IsFile);

public interface IRecentDocumentsModule
{
    IReadOnlyList<RecentDocument> GetRecentDocuments();
    bool OpenRecentDocument(Window window, string id);
}
