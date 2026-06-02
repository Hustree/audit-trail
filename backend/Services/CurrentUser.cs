namespace AuditTrailPoc.Api.Services;

/// <summary>
/// Scoped current-user resolver. Returns a default demo identity, or the value of the
/// X-Demo-User request header when present, for demonstration purposes.
/// </summary>
public class CurrentUser : ICurrentUser
{
    private const string DefaultUser = "demo.admin@local";
    private const string DemoUserHeader = "X-Demo-User";

    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string UserId
    {
        get
        {
            var header = _httpContextAccessor.HttpContext?.Request.Headers[DemoUserHeader].ToString();
            return string.IsNullOrWhiteSpace(header) ? DefaultUser : header;
        }
    }
}
