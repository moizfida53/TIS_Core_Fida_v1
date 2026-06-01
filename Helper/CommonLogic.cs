using Microsoft.Extensions.Configuration;

namespace TIS.Helpers
{
    /// <summary>
    /// Provides common utility methods for application configuration
    /// </summary>
    public class CommonLogic
    {
        private readonly IConfiguration _configuration;

        public CommonLogic(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// Gets connection string from appsettings.json
        /// </summary>
        /// <param name="paramName">Connection string name</param>
        /// <returns>Connection string value or empty string if not found</returns>
        public string GetConnectionString(string paramName)
        {
            try
            {
                return _configuration.GetConnectionString(paramName) ?? string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }

        /// <summary>
        /// Static method for backward compatibility (requires configuration to be passed)
        /// </summary>
        public static string ConnectionString(IConfiguration configuration, string paramName)
        {
            try
            {
                return configuration?.GetConnectionString(paramName) ?? string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }
    }
}