using Notarium.Contracts;
namespace Notarium.Shell;

public sealed record ModuleEntry(string Id, string DisplayName, INotariumModule? Implementation = null)
{
    public bool IsAvailable => Implementation is not null;
}
