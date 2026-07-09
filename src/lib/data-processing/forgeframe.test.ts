import ForgeFrame from "@/lib/data-processing/forgeframe";

function generateTestData(): ForgeFrame {
    return new ForgeFrame([
        { fruit: "apple", sweetness: 0.5, color: "red" },
        { fruit: "orange", sweetness: 0.6, color: "orange" },
        { fruit: "peach", sweetness: 0.7, color: "pink" },
        { fruit: "blueberry", sweetness: 0.7, color: "blue" },
        { fruit: "strawberry", sweetness: 0.8, color: "red" },
    ]);
}


describe("ForgeFrame functions", () => {

    test("values() is as expected", () => {
        const dataframe = generateTestData();

        const expected_values = [
            ["apple", 0.5, "red"],
            ["orange", 0.6, "orange"],
            ["peach", 0.7, "pink"],
            ["blueberry", 0.7, "blue"],
            ["strawberry", 0.8, "red"],
        ];

        expect(dataframe.values).toEqual(expected_values);
    });


    test("reset() restores original data", () => {
        const dataframe = generateTestData();
        const original_values = dataframe.values;

        dataframe.drop({ columns: "fruit", inplace: true });
        expect(dataframe.values).not.toEqual(original_values);

        dataframe.reset();
        expect(dataframe.values).toEqual(original_values);
    });


    test("row count decreases after where()", () => {
        const dataframe = generateTestData();
        const initial_row_count = dataframe.shape[0];

        expect(() => { dataframe.where("fruit", "in", "apple") }).toThrow();
        expect(() => { dataframe.where("non_existent_column", "in", ["apple"]) }).toThrow();
        expect(() => { dataframe.where("fruit", "non_existant_operator", ["apple"]) }).toThrow();

        dataframe.where("sweetness", ">=", 0.7, { inplace: true })
            .where("sweetness", ">", 0.7, { inplace: true })
            .where("sweetness", "<=", 1, { inplace: true })
            .where("sweetness", "<", 1, { inplace: true })
            .where("fruit", "!=", "strawberry", { inplace: true })
            .where("fruit", "=", "strawberry", { inplace: true })
            .where("fruit", "notin", ["peach"], { inplace: true })
            .where("fruit", "in", ["apple", "orange", "peach", "blueberry", "strawberry"], { inplace: true })
            .where("fruit", "empty", false, { inplace: true })
            .where("fruit", "notempty", false, { inplace: true })
            .where("fruit", "contains", "q", { inplace: true })
            .where("fruit", "startswith", "a", { inplace: true })
            .where("fruit", "endswith", "e", { inplace: true })
        expect(dataframe.shape[0]).not.toBe(initial_row_count);
        expect(dataframe.shape[0]).toEqual(0);

        dataframe.reset();

        dataframe.where("color", "=", "superb_color_outta_this_world", { inplace: true });
        expect(dataframe.shape[0]).toEqual(0);
    });


    test("types property is updated when ForgeFrame functions are run", () => {
        const dataframe = generateTestData();
        const original_types = dataframe.types;

        dataframe.drop({ columns: "fruit", inplace: true });
        expect(dataframe.types).not.toEqual(original_types);

        dataframe.reset();
        expect(dataframe.types).toEqual(original_types);

        // sort columns alphabetically
        dataframe.rearrange({ columns: dataframe.columns.toSorted(), inplace: true });
        expect(dataframe.types).toEqual(original_types);

        // sort columns alphabetically reversed
        dataframe.rearrange({ columns: dataframe.columns.toSorted().toReversed(), inplace: true });
        expect(dataframe.types).toEqual(original_types);

        dataframe.concatColumns(["fruit", "sweetness"], { inplace: true })
        expect(dataframe.types).not.toEqual(original_types);
    });


    test("concatColumns() creates a new column with name as all selected columns combined", () => {
        const dataframe = generateTestData();
        const original_col_count = dataframe.columns.length;
        const new_col_name = dataframe.columns.join("_");

        expect(() => { dataframe.concatColumns(dataframe.columns, { inplace: true, colname: dataframe.columns[0] }) }).toThrow();
        expect(() => { dataframe.concatColumns([], { inplace: true }) }).toThrow();

        dataframe.concatColumns(dataframe.columns, { inplace: true });

        expect(dataframe.columns.length).toEqual(original_col_count + 1);
        expect(dataframe.columns).toContain(new_col_name);
    });


    test("rearrange columns in alphabetical order and reversed order", () => {
        const dataframe = generateTestData();
        const original_shape = dataframe.shape;

        expect(() => { dataframe.rearrange({ columns: [dataframe.columns[0]] }) }).toThrow();

        const expected_col_order = dataframe.columns.toSorted()
        dataframe.rearrange({ columns: expected_col_order, inplace: true });

        expect(dataframe.columns).toEqual(expected_col_order);

        const expected_reversed_col_order = expected_col_order.toReversed();
        dataframe.rearrange({ columns: expected_reversed_col_order, inplace: true });

        expect(dataframe.columns).toEqual(expected_reversed_col_order);

        expect(dataframe.shape).toEqual(original_shape);
    });


    test("copied dataframe is equivalent to original", () => {
        const dataframe = generateTestData();
        dataframe.drop({ columns: dataframe.columns, inplace: true });

        const copied = dataframe.copy();
        copied.reset();

        // dataframe is empty, copied is not
        expect(copied.columns).not.toEqual(dataframe.columns);
        expect(copied.dataset()).not.toEqual(dataframe.dataset());

        // both dataframes are reset back to original form
        dataframe.reset();
        expect(copied.columns).toEqual(dataframe.columns);
        expect(copied.dataset()).toEqual(dataframe.dataset());

    });


    test("dataset() removes rows with null/undefined/NaN values", () => {
        const dataframe = generateTestData();

        const random_row = Math.floor(Math.random() * dataframe.shape[0]);
        const random_col = Math.floor(Math.random() * dataframe.shape[1]);

        // randomly set an element to undefined
        const values = dataframe.values as (any)[][];
        values[random_row][random_col] = undefined;

        const dataset = dataframe.dataset();

        expect(dataset.length).not.toEqual(dataframe.shape[0]);
    });

});
