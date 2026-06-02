namespace AuditTrailPoc.Api.Services;

/// <summary>
/// Resolves the actor for audit attribution. A real target wires this to its auth layer;
/// this POC stubs a default user, overridable per request via the X-Demo-User header.
/// </summary>
public interface ICurrentUser
{
    string UserId { get; }
}
