namespace AuditTrailPoc.Api.Domain;

/// <summary>
/// The audited demo record. Uses soft-delete via <see cref="IsActive"/> so the row,
/// and therefore its captured snapshot, survives a delete.
/// </summary>
public class Accident
{
    public int Id { get; set; }
    public string ReferenceCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public string? CreatedBy { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedDate { get; set; }
}
