from generate_seed_sql import escape_sql_literal, generate_seed_sql, tank_to_sql


def test_escapes_single_quotes():
    assert escape_sql_literal("O'Brien") == "O''Brien"


def test_tank_to_sql_produces_cte_insert_pair():
    sql = tank_to_sql("015", {
        "manufacturer": "ZCL P86 DW",
        "capacity_liters": 50000.0,
        "points": [(2.0, 99.0), (4.0, 215.0)],
    })
    assert "INSERT INTO tank_types" in sql
    assert "'015'" in sql
    assert "INSERT INTO dip_chart_points" in sql
    assert "(2.0,99.0)" in sql


def test_generate_seed_sql_joins_multiple_tanks_with_blank_line():
    tanks = {
        "015": {"manufacturer": "ZCL", "capacity_liters": 50000.0, "points": [(2.0, 99.0)]},
        "014": {"manufacturer": "ZCL", "capacity_liters": 35000.0, "points": [(2.0, 65.0)]},
    }
    sql = generate_seed_sql(tanks)
    assert sql.count("WITH ins AS") == 2
