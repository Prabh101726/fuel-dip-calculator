from parse_dip_charts import (
    TankRecord,
    clean_number,
    detect_anomalous_layout,
    group_words_into_lines,
    parse_data_rows,
    parse_header,
    split_header_and_data,
)


def word(text: str, x0: float, top: float) -> dict:
    return {"text": text, "x0": x0, "top": top}


class TestCleanNumber:
    def test_parses_plain_integer(self):
        assert clean_number("38209") == 38209.0

    def test_strips_thousands_comma(self):
        assert clean_number("14,700") == 14700.0

    def test_parses_decimal(self):
        assert clean_number("49449.13") == 49449.13

    def test_rejects_malformed_token(self):
        assert clean_number("38/117") is None


class TestGroupWordsIntoLines:
    def test_groups_words_at_same_y_into_one_line_sorted_by_x(self):
        words = [
            word("102", 331.6, 100.5),
            word("2", 215.7, 100.5),
            word("3982", 382.5, 100.5),
            word("15", 266.2, 100.5),
        ]
        lines = group_words_into_lines(words)
        assert len(lines) == 1
        assert [w["text"] for w in lines[0]] == ["2", "15", "102", "3982"]

    def test_separates_lines_more_than_tolerance_apart(self):
        words = [word("2", 215.7, 100.5), word("4", 215.7, 112.9)]
        lines = group_words_into_lines(words)
        assert len(lines) == 2


class TestSplitHeaderAndData:
    def test_splits_at_first_all_numeric_line(self):
        lines = [
            [word("TANK", 253.7, 59.5), word("TYPE", 289.9, 59.5), word("#002", 328.0, 59.5)],
            [word("DTE", 193.1, 75.4), word("CAPACITY", 314.6, 75.4), word("4621", 367.7, 75.4)],
            [word("2", 215.7, 100.5), word("15", 266.2, 100.5)],
        ]
        header, data = split_header_and_data(lines)
        assert len(header) == 2
        assert len(data) == 1

    def test_no_data_lines_returns_everything_as_header(self):
        lines = [[word("PCC", 100, 50), word("#996", 150, 50)]]
        header, data = split_header_and_data(lines)
        assert header == lines
        assert data == []


class TestParseHeader:
    def test_parses_standard_header(self):
        header_lines = [
            [word("TANK", 253.7, 59.5), word("TYPE", 289.9, 59.5), word("#015", 328.0, 59.5)],
            [word("ZCL", 100, 75.4), word("P86", 130, 75.4), word("CAPACITY", 250, 75.4), word("50000", 330, 75.4)],
        ]
        header = parse_header(header_lines)
        assert header["chart_number"] == "015"
        assert header["part_num"] == 1
        assert header["capacity_liters"] == 50000.0

    def test_parses_continuation_header(self):
        header_lines = [[
            word("TANK", 100, 50), word("TYPE", 130, 50), word("#131", 160, 50),
            word("2", 190, 50), word("OF", 200, 50), word("2", 220, 50),
        ]]
        header = parse_header(header_lines)
        assert header["chart_number"] == "131"
        assert header["part_num"] == 2

    def test_returns_none_when_no_tank_type_header_present(self):
        header_lines = [[word("PCC", 100, 50), word("#996", 150, 50), word("matches", 180, 50)]]
        assert parse_header(header_lines) is None


class TestDetectAnomalousLayout:
    def test_flags_triple_column_marker(self):
        header = {"raw_header": "TANK TYPE #1016 DIP VOLUME @ 95%"}
        reason = detect_anomalous_layout(header, [[word("1", 0, 0), word("2", 10, 0)]])
        assert reason is not None

    def test_flags_mostly_odd_length_rows(self):
        header = {"raw_header": "TANK TYPE #226"}
        data_lines = [
            [word("1", 0, 0), word("2", 10, 0), word("3", 20, 0)],
            [word("1", 0, 10), word("2", 10, 10), word("3", 20, 10)],
        ]
        reason = detect_anomalous_layout(header, data_lines)
        assert reason is not None

    def test_allows_standard_even_length_rows(self):
        header = {"raw_header": "TANK TYPE #015"}
        data_lines = [[word("2", 0, 0), word("99", 10, 0)]]
        assert detect_anomalous_layout(header, data_lines) is None


class TestParseDataRows:
    def test_pairs_consecutive_tokens_per_line(self):
        lines = [[word("2", 0, 0), word("99", 10, 0), word("102", 20, 0), word("19622", 30, 0)]]
        points = parse_data_rows(lines, page_num=13, warnings=[])
        assert points == [(2.0, 99.0), (102.0, 19622.0)]

    def test_drops_trailing_unpaired_token_with_warning(self):
        lines = [[word("2", 0, 0), word("99", 10, 0), word("102", 20, 0)]]
        warnings: list[str] = []
        points = parse_data_rows(lines, page_num=13, warnings=warnings)
        assert points == [(2.0, 99.0)]
        assert len(warnings) == 1

    def test_drops_malformed_pair_with_warning(self):
        lines = [[word("8", 0, 0), word("38/117", 10, 0)]]
        warnings: list[str] = []
        points = parse_data_rows(lines, page_num=325, warnings=warnings)
        assert points == []
        assert len(warnings) == 1
