using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Data;
using Microsoft.Data.SqlClient;
using TIS.Helpers;

namespace TIS.Models;

/// <summary>
/// Represents a dashboard transaction-type data row used in chart and grid queries.
/// Renamed from <c>transactiontype</c> to follow PascalCase conventions.
/// All query logic is preserved; only naming and patterns are updated for .NET 10.
/// </summary>
public class TransactionType
{
    // ── Properties ───────────────────────────────────────────────────────────

    [Display(Name = "Amount")]
    public int Amount { get; init; }

    [Display(Name = "Transaction Type")]
    public string? TransType { get; init; }

    [Display(Name = "Call Amount")]
    public float CallAmount { get; init; }

    [Display(Name = "Call Type")]
    public string? CallType { get; init; }

    [Display(Name = "Country-wise Sum")]
    public float CountryWiseSum { get; init; }

    [Display(Name = "Country")]
    public string? OutCountry { get; init; }

    // ── Query methods (now require a DB instance) ───────────────────────────────

    /// <summary>
    /// Returns transaction type totals for the main dashboard chart (SP: gettype).
    /// Requires a configured DB instance (from DI or factory).
    /// </summary>
    public List<TransactionType> GetTransactionTypes(DB db)
    {
        if (db is null) throw new ArgumentNullException(nameof(db));

        var list = new List<TransactionType>();

        DataSet ds = db.ExecuteStoredProcDataSet("gettype");
        foreach (DataRow row in ds.Tables[0].Rows)
        {
            list.Add(new TransactionType
            {
                Amount    = Convert.ToInt32(row["amount"]),
                TransType = row["TRANS_TYPE"].ToString()
            });
        }

        return list;
    }

    /// <summary>
    /// Obsolete: use GetTransactionTypes(DB) instead.
    /// This overload exists to provide a clear compile/runtime message if callers were not updated.
    /// </summary>
    [Obsolete("Use GetTransactionTypes(DB db) and pass a configured DB instance (e.g. from DI).", true)]
    public List<TransactionType> GetTransactionTypes()
    {
        throw new InvalidOperationException("GetTransactionTypes() is obsolete. Pass a configured DB instance: GetTransactionTypes(DB db).");
    }

    /// <summary>
    /// Returns call-type breakdown amounts for a given year (SP: sp_GetDashboardChart4).
    /// </summary>
    public List<TransactionType> GetCallTypes(DB db, int year)
    {
        if (db is null) throw new ArgumentNullException(nameof(db));

        var list = new List<TransactionType>();

        SqlParameter[] parameters = new SqlParameter[]
        {
            new SqlParameter { ParameterName = "@Year", SqlDbType = SqlDbType.Int, Value = year }
        };

        DataSet ds = db.ExecuteStoredProcDataSet("sp_GetDashboardChart4", parameters);
        foreach (DataRow row in ds.Tables[0].Rows)
        {
            list.Add(new TransactionType
            {
                CallAmount = Convert.ToSingle(row["Call_amount"]),
                CallType   = row["Call_type"].ToString()
            });
        }

        return list;
    }

    [Obsolete("Use GetCallTypes(DB db, int year) and pass a configured DB instance (e.g. from DI).", true)]
    public List<TransactionType> GetCallTypes(int year)
    {
        throw new InvalidOperationException("GetCallTypes(year) is obsolete. Pass a configured DB instance: GetCallTypes(DB db, int year).");
    }

    /// <summary>
    /// Returns country-wise international call sums for a given year and call type
    /// (SP: sp_GetDashboardChart6).
    /// </summary>
    public List<TransactionType> GetInternationalCountrySums(DB db, int year, string callType)
    {
        if (db is null) throw new ArgumentNullException(nameof(db));

        var list = new List<TransactionType>();

        SqlParameter[] parameters = new SqlParameter[]
        {
            new SqlParameter { ParameterName = "@Year",      SqlDbType = SqlDbType.Int,     Value = year     },
            new SqlParameter { ParameterName = "@Call_type", SqlDbType = SqlDbType.NVarChar, Value = callType }
        };

        DataSet ds = db.ExecuteStoredProcDataSet("sp_GetDashboardChart6", parameters);
        foreach (DataRow row in ds.Tables[0].Rows)
        {
            list.Add(new TransactionType
            {
                CountryWiseSum = Convert.ToSingle(row["Countrywisesum"]),
                OutCountry     = row["OUT_COUNTRY"].ToString()
            });
        }

        return list;
    }

    [Obsolete("Use GetInternationalCountrySums(DB db, int year, string callType) and pass a configured DB instance (e.g. from DI).", true)]
    public List<TransactionType> GetInternationalCountrySums(int year, string callType)
    {
        throw new InvalidOperationException("GetInternationalCountrySums(year, callType) is obsolete. Pass a configured DB instance: GetInternationalCountrySums(DB db, int year, string callType).");
    }

    /// <summary>
    /// Returns country-wise charge totals for the detail grid for a given year
    /// (SP: getdataingrid).
    /// </summary>
    public List<TransactionType> GetCountryDetailsInGrid(DB db, int year)
    {
        if (db is null) throw new ArgumentNullException(nameof(db));

        var list = new List<TransactionType>();

        SqlParameter[] parameters = new SqlParameter[]
        {
            new SqlParameter { ParameterName = "@Year", SqlDbType = SqlDbType.Int, Value = year }
        };

        DataSet ds = db.ExecuteStoredProcDataSet("getdataingrid", parameters);
        foreach (DataRow row in ds.Tables[0].Rows)
        {
            list.Add(new TransactionType
            {
                CountryWiseSum = Convert.ToSingle(row["Countrywisesum"]),
                OutCountry     = row["OUT_COUNTRY"].ToString()
            });
        }

        return list;
    }

    [Obsolete("Use GetCountryDetailsInGrid(DB db, int year) and pass a configured DB instance (e.g. from DI).", true)]
    public List<TransactionType> GetCountryDetailsInGrid(int year)
    {
        throw new InvalidOperationException("GetCountryDetailsInGrid(year) is obsolete. Pass a configured DB instance: GetCountryDetailsInGrid(DB db, int year).");
    }

    /// <summary>
    /// Returns country-wise charge totals filtered by year and month for the detail grid
    /// (SP: getdataingrid with month parameter).
    /// </summary>
    public List<TransactionType> GetCountryMonthWiseInGrid(DB db, int year, int month)
    {
        if (db is null) throw new ArgumentNullException(nameof(db));

        var list = new List<TransactionType>();

        SqlParameter[] parameters = new SqlParameter[]
        {
            new SqlParameter { ParameterName = "@Year",  SqlDbType = SqlDbType.Int, Value = year  },
            new SqlParameter { ParameterName = "@month", SqlDbType = SqlDbType.Int, Value = month }
        };

        DataSet ds = db.ExecuteStoredProcDataSet("getdataingrid", parameters);
        foreach (DataRow row in ds.Tables[0].Rows)
        {
            list.Add(new TransactionType
            {
                CountryWiseSum = Convert.ToSingle(row["Countrywisesum"]),
                OutCountry     = row["OUT_COUNTRY"].ToString()
            });
        }

        return list;
    }

    [Obsolete("Use GetCountryMonthWiseInGrid(DB db, int year, int month) and pass a configured DB instance (e.g. from DI).", true)]
    public List<TransactionType> GetCountryMonthWiseInGrid(int year, int month)
    {
        throw new InvalidOperationException("GetCountryMonthWiseInGrid(year, month) is obsolete. Pass a configured DB instance: GetCountryMonthWiseInGrid(DB db, int year, int month).");
    }
}
