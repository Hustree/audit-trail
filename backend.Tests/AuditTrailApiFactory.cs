using AuditTrailPoc.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuditTrailPoc.Tests;

/// <summary>
/// A WebApplicationFactory that swaps the API's file-backed SQLite for a fresh, isolated
/// in-memory SQLite connection per factory instance, so tests never touch the dev
/// audittrail.db and each test class gets a clean database.
/// </summary>
public sealed class AuditTrailApiFactory : WebApplicationFactory<Program>
{
    // Kept open for the lifetime of the factory so the in-memory database survives between requests.
    private readonly SqliteConnection _connection;

    public AuditTrailApiFactory()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Drop the app's default DbContext registration (file-backed SQLite).
            var descriptors = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                            || d.ServiceType == typeof(AppDbContext))
                .ToList();
            foreach (var d in descriptors)
            {
                services.Remove(d);
            }

            // Re-register against our isolated in-memory connection, preserving the real
            // audit interceptor that the app registered as a scoped service.
            services.AddDbContext<AppDbContext>((sp, options) =>
            {
                options.UseSqlite(_connection);
                options.AddInterceptors(
                    sp.GetRequiredService<AuditTrailPoc.Api.Auditing.AuditSaveChangesInterceptor>());
            });
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}
