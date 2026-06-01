using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Data;
using System.Threading.Tasks;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Helpers
{
    /// <summary>
    /// Database helper class for executing stored procedures and SQL commands
    /// Supports both sync and async operations
    /// </summary>
    public class DB
    {
        private static FixedSizedQueue<DBLogger> DBLog = new FixedSizedQueue<DBLogger>(1000);
        private readonly string _connectionString;
        private readonly ILogger<DB>? _logger;

        /// <summary>
        /// Initializes a new instance of DB with dependency injection
        /// </summary>
        public DB(IConfiguration configuration, ILogger<DB>? logger = null)
        {
            _connectionString = configuration.GetConnectionString("SqlServerConnectionString") ?? throw new InvalidOperationException("Connection string 'SqlServerConnectionString' not found");
            _logger = logger;
        }

        /// <summary>
        /// Creates a new SQL connection
        /// </summary>
        public SqlConnection GetConnection() => new SqlConnection(_connectionString);

        #region Synchronous Methods

        /// <summary>
        /// Executes a stored procedure without parameters
        /// </summary>
        public int ExecuteStoredProc(string storedProcName)
        {
            return ExecuteStoredProc(storedProcName, null);
        }

        /// <summary>
        /// Executes a stored procedure with parameters
        /// </summary>
        public int ExecuteStoredProc(string storedProcName, SqlParameter[]? paramColl)
        {
            int result = -1;
            string exceptionMessage = string.Empty;

            using (var connection = GetConnection())
            {
                connection.Open();
                using (var command = new SqlCommand(storedProcName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandTimeout = 0;

                    if (paramColl != null)
                    {
                        command.Parameters.AddRange(paramColl);
                    }

                    var startTime = DateTime.Now;
                    try
                    {
                        result = command.ExecuteNonQuery();
                    }
                    catch (SqlException ex)
                    {
                        exceptionMessage = ex.Message;
                        _logger?.LogError(ex, "Error executing stored procedure {ProcedureName}", storedProcName);
                        throw;
                    }
                    finally
                    {
                        LogExecution(startTime, storedProcName, exceptionMessage);
                    }
                }
            }

            return result;
        }

        /// <summary>
        /// Executes a stored procedure and returns the return value
        /// </summary>
        public int ExecuteSpRetVal(string storedProcName, SqlParameter[] paramColl)
        {
            string exceptionMessage = string.Empty;
            int returnValue = 0;

            using (var connection = GetConnection())
            {
                connection.Open();
                using (var command = new SqlCommand(storedProcName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandTimeout = 0;

                    if (paramColl != null)
                    {
                        command.Parameters.AddRange(paramColl);
                    }

                    var returnParameter = command.Parameters.Add("RetVal", SqlDbType.Int);
                    returnParameter.Direction = ParameterDirection.ReturnValue;

                    var startTime = DateTime.Now;
                    try
                    {
                        command.ExecuteNonQuery();
                        returnValue = (int)returnParameter.Value;
                    }
                    catch (SqlException ex)
                    {
                        exceptionMessage = ex.Message;
                        _logger?.LogError(ex, "Error executing stored procedure {ProcedureName}", storedProcName);
                        throw;
                    }
                    finally
                    {
                        LogExecution(startTime, storedProcName, exceptionMessage);
                    }
                }
            }

            return returnValue;
        }

        /// <summary>
        /// Executes a stored procedure and returns a scalar value
        /// </summary>
        public object? ExecuteStoredProcScalar(string storedProcName, SqlParameter[] paramColl)
        {
            object? result = null;
            string exceptionMessage = string.Empty;

            using (var connection = GetConnection())
            {
                connection.Open();
                using (var command = new SqlCommand(storedProcName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandTimeout = 0;

                    command.Parameters.AddRange(paramColl);

                    var startTime = DateTime.Now;
                    try
                    {
                        result = command.ExecuteScalar();
                    }
                    catch (SqlException ex)
                    {
                        exceptionMessage = ex.Message;
                        _logger?.LogError(ex, "Error executing stored procedure {ProcedureName}", storedProcName);
                        throw;
                    }
                    finally
                    {
                        LogExecution(startTime, storedProcName, exceptionMessage);
                    }
                }
            }

            return result;
        }

        /// <summary>
        /// Executes a stored procedure and returns a DataSet
        /// </summary>
        public DataSet ExecuteStoredProcDataSet(string storedProcName) => ExecuteStoredProcDataSet(storedProcName, null);

        /// <summary>
        /// Executes a stored procedure with parameters and returns a DataSet
        /// </summary>
        public DataSet ExecuteStoredProcDataSet(string storedProcName, SqlParameter[]? paramColl)
        {
            string exceptionMessage = string.Empty;

            using (var connection = GetConnection())
            {
                connection.Open();
                using (var command = new SqlCommand(storedProcName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandTimeout = 0;

                    if (paramColl != null)
                    {
                        command.Parameters.AddRange(paramColl);
                    }

                    using (var adapter = new SqlDataAdapter(command))
                    {
                        var dataSet = new DataSet();
                        var startTime = DateTime.Now;

                        try
                        {
                            adapter.Fill(dataSet);
                        }
                        catch (SqlException ex)
                        {
                            exceptionMessage = ex.Message;
                            _logger?.LogError(ex, "Error executing stored procedure {ProcedureName}", storedProcName);
                            throw;
                        }
                        finally
                        {
                            LogExecution(startTime, storedProcName, exceptionMessage);
                        }

                        return dataSet;
                    }
                }
            }
        }

        /// <summary>
        /// Executes a raw SQL query and returns a DataSet
        /// </summary>
        public DataSet? GetData(string sql)
        {
            var dataSet = new DataSet();

            try
            {
                using (var connection = GetConnection())
                {
                    connection.Open();
                    sql = sql.Replace("\r\n", " ");

                    using (var adapter = new SqlDataAdapter(sql, connection))
                    {
                        adapter.Fill(dataSet);
                    }
                }

                if (dataSet.Tables[0].Rows.Count == 0)
                    return null;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error executing SQL query");
                return null;
            }

            return dataSet;
        }

        /// <summary>
        /// Executes a raw SQL non-query command
        /// </summary>
        public void ExecuteNonQuery(string sql)
        {
            try
            {
                using (var connection = GetConnection())
                {
                    connection.Open();
                    sql = sql.Replace("\r\n", " ");

                    using (var command = new SqlCommand(sql, connection))
                    {
                        command.CommandTimeout = 0;
                        command.ExecuteNonQuery();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error executing non-query SQL");
            }
        }

        /// <summary>
        /// Executes a SQL query and returns a single value
        /// </summary>
        public string GetValue(string sql)
        {
            string result = string.Empty;
            var data = GetData(sql);

            if (data != null && data.Tables.Count > 0 && data.Tables[0].Rows.Count > 0)
                result = data.Tables[0].Rows[0][0].ToString() ?? string.Empty;

            return result;
        }

        #endregion

        #region Async Methods

        /// <summary>
        /// Executes a stored procedure asynchronously
        /// </summary>
        public async Task<int> ExecuteStoredProcAsync(string storedProcName, SqlParameter[]? paramColl = null)
        {
            int result = -1;
            string exceptionMessage = string.Empty;

            using (var connection = GetConnection())
            {
                await connection.OpenAsync();
                using (var command = new SqlCommand(storedProcName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandTimeout = 0;

                    if (paramColl != null)
                    {
                        command.Parameters.AddRange(paramColl);
                    }

                    var startTime = DateTime.Now;
                    try
                    {
                        result = await command.ExecuteNonQueryAsync();
                    }
                    catch (SqlException ex)
                    {
                        exceptionMessage = ex.Message;
                        _logger?.LogError(ex, "Error executing stored procedure {ProcedureName}", storedProcName);
                        throw;
                    }
                    finally
                    {
                        LogExecution(startTime, storedProcName, exceptionMessage);
                    }
                }
            }

            return result;
        }

        /// <summary>
        /// Executes a stored procedure asynchronously and returns a DataSet
        /// </summary>
        public async Task<DataSet> ExecuteStoredProcDataSetAsync(string storedProcName, SqlParameter[]? paramColl = null)
        {
            string exceptionMessage = string.Empty;

            using (var connection = GetConnection())
            {
                await connection.OpenAsync();
                using (var command = new SqlCommand(storedProcName, connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandTimeout = 0;

                    if (paramColl != null)
                    {
                        command.Parameters.AddRange(paramColl);
                    }

                    using (var adapter = new SqlDataAdapter(command))
                    {
                        var dataSet = new DataSet();
                        var startTime = DateTime.Now;

                        try
                        {
                            // SqlDataAdapter doesn't have async Fill, so we use Task.Run
                            await Task.Run(() => adapter.Fill(dataSet));
                        }
                        catch (SqlException ex)
                        {
                            exceptionMessage = ex.Message;
                            _logger?.LogError(ex, "Error executing stored procedure {ProcedureName}", storedProcName);
                            throw;
                        }
                        finally
                        {
                            LogExecution(startTime, storedProcName, exceptionMessage);
                        }

                        return dataSet;
                    }
                }
            }
        }

        #endregion

        #region Parameter Helper Methods

        public static SqlParameter SetValue(SqlParameter sparam, object? value)
        {
            sparam.Value = value ?? DBNull.Value;
            return sparam;
        }

        public static SqlParameter SetValueDecimal(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = Convert.ToDecimal(value.ToString());
            return sparam;
        }

        public static SqlParameter SetValueBool(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = Convert.ToBoolean(value.ToString());
            return sparam;
        }

        public static SqlParameter SetValueSmallInt(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = Convert.ToInt16(value.ToString());
            return sparam;
        }

        public static SqlParameter SetValueTinyInt(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = Convert.ToByte(Convert.ToInt32(value));
            return sparam;
        }

        public static SqlParameter SetValueInt(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = Convert.ToInt32(value.ToString());
            return sparam;
        }

        public static SqlParameter SetValueBigInt(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = Convert.ToInt64(value.ToString());
            return sparam;
        }

        public static SqlParameter SetValueDateTime(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = DateTime.Parse(value.ToString()!);
            return sparam;
        }

        public static SqlParameter SetValueGUID(SqlParameter sparam, object? value)
        {
            if (value == null)
                sparam.Value = DBNull.Value;
            else
                sparam.Value = (Guid)value;
            return sparam;
        }

        #endregion

        #region Utility Methods

        public static string GetNewGUID() => Guid.NewGuid().ToString();

        #endregion

        #region Private Methods

        private void LogExecution(DateTime startTime, string procedureName, string exceptionMessage)
        {
            int timeTaken = (int)DateTime.Now.Subtract(startTime).TotalMilliseconds;

            DBLog.Enqueue(new DBLogger
            {
                ExecTime = startTime,
                Procedure = procedureName,
                TimeTaken = timeTaken,
                Exception = exceptionMessage
            });
        }

        #endregion
    }
}