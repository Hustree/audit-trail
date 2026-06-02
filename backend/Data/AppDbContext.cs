using AuditTrailPoc.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuditTrailPoc.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Accident> Accidents => Set<Accident>();
    public DbSet<AuditTrail> AuditTrails => Set<AuditTrail>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Accident>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ReferenceCode).IsRequired();
            entity.Property(e => e.Title).IsRequired();
            entity.HasIndex(e => e.ReferenceCode);
        });

        modelBuilder.Entity<AuditTrail>(entity =>
        {
            entity.HasKey(e => e.Id);
            // ActionType and Module are stored as plain strings to keep the log human-readable.
            entity.HasIndex(e => e.ReferenceCode);
            entity.HasIndex(e => e.ActionType);
            entity.HasIndex(e => e.Module);
        });
    }
}
