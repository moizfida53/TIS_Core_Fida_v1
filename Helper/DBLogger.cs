using System;

namespace TIS.Models
{
    /// <summary>
    /// Model for logging database operation metrics
    /// </summary>
    public class DBLogger
    {
        /// <summary>
        /// The time when the database operation was executed
        /// </summary>
        public DateTime ExecTime { get; set; }

        /// <summary>
        /// Name of the stored procedure or SQL command executed
        /// </summary>
        public string Procedure { get; set; } = string.Empty;

        /// <summary>
        /// Time taken for the operation in milliseconds
        /// </summary>
        public int TimeTaken { get; set; }

        /// <summary>
        /// Exception message if the operation failed
        /// </summary>
        public string Exception { get; set; } = string.Empty;
    }
}