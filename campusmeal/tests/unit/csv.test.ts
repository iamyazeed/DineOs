import { describe, expect, it } from "vitest";
import { parseTable, rowsToRecords } from "@/lib/utils/csv";
import { identifierToEmail, numberedName, studentLoginId } from "@/lib/utils/login-id";

const COLS = [{ key: "name" }, { key: "class", aliases: ["class name"] }, { key: "roll", aliases: ["roll no"] }] as const;

describe("parseTable", () => {
  it("reads comma CSV with quotes and CRLF", () => {
    expect(parseTable('name,class\r\n"Abu, Jr",S1\r\nMalik,S2\r\n')).toEqual([["name", "class"], ["Abu, Jr", "S1"], ["Malik", "S2"]]);
  });
  it("reads tab-separated text pasted from a spreadsheet", () => {
    expect(parseTable("Abu\tS1\t1\nMalik\tS1\t2")).toEqual([["Abu", "S1", "1"], ["Malik", "S1", "2"]]);
  });
  it("skips blank lines and handles escaped quotes", () => {
    expect(parseTable('a,"say ""hi"""\n\n')).toEqual([["a", 'say "hi"']]);
  });
});

describe("rowsToRecords", () => {
  it("matches columns by header name in any order", () => {
    const r = rowsToRecords(parseTable("Roll No,Name,Class\n3,Nizam,S1"), COLS);
    expect(r).toEqual([{ name: "Nizam", class: "S1", roll: "3" }]);
  });
  it("does not mistake a data row with blanks for a header", () => {
    expect(rowsToRecords([["Abu", "S1", ""], ["Malik", "S1", ""]], COLS)).toHaveLength(2);
  });
  it("falls back to column order with no header", () => {
    expect(rowsToRecords([["Abu", "S1"]], COLS)).toEqual([{ name: "Abu", class: "S1", roll: "" }]);
  });
});

describe("login ids", () => {
  it("builds and resolves student IDs", () => {
    expect(studentLoginId("kmoia", 7)).toBe("KMOIA007");
    expect(identifierToEmail(" KMOIA007 ")).toBe("kmoia007@students.dineos");
    expect(identifierToEmail("Test@Chef")).toBe("test@chef.demo");
    expect(identifierToEmail("a@b.com")).toBe("a@b.com");
    expect(numberedName("Abu", 1)).toBe("Abu - 001");
  });
});
