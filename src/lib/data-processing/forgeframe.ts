import { DataFrame } from "danfojs";
//import type { ArrayType2D, ArrayType1D, BaseDataOptionType } from "danfojs/dist/danfojs-base/shared/types";

// the following types come from danfojs/dist/danfojs-base/shared/types which in v1.2.0 the linter or Intellisense complains about
export declare type ArrayType2D = Array<number[] | string[] | boolean[] | (number | string | boolean)[]>;
export declare type ArrayType1D = Array<number | string | boolean | (number | string | boolean)>;
export declare type ConfigsType = {
    tableMaxRow?: number;
    tableMaxColInConsole?: number;
    dtypeTestLim?: number;
    lowMemoryMode?: boolean;
    tfInstance?: any;
};
export interface BaseDataOptionType {
    type?: number;
    index?: Array<string | number>;
    columns?: string[];
    dtypes?: Array<string>;
    config?: ConfigsType;
    binaryAsBoolean?: boolean;
}

// supported types come from Danfo.js source code at
// danfojs/danfjs-base/core/frame.js > selectDtypes
interface DataTypes {
    [key: string]: "float32" | "int32" | "string" | "boolean"
}


export default class ForgeFrame extends DataFrame {
    private initial_values: ArrayType1D | ArrayType2D = [];
    private initial_columns: string[] = [];
    private initial_dtypes: string[] = [];
    public types: DataTypes = {};
    public readonly initial_shape = [this.initial_values.length, this.initial_columns.length];
    private binary_as_boolean: boolean = false;


    constructor(data?: any, options?: BaseDataOptionType) {
        super(data, options);

        this.binary_as_boolean = options?.binaryAsBoolean ?? false;
        this.types = this.dtypesMap();

        if (this.binary_as_boolean) {
            this.binaryTypeAsBoolean();
        }

        this.initial_values = this.values.slice();
        this.initial_columns = this.columns.slice();
        this.initial_dtypes = this.dtypes.slice();
    }


    /**
     * Change all binary column types (0 and 1) that are int32 and float32
     * to boolean. There are no transformations on the underlying data.
     * 
     * This should not be run before setting this.types
     */
    private binaryTypeAsBoolean() {
        for (const col of this.columns) {
            if (this.types[col] == "int32" || this.types[col] == "float32") {
                const [zero, one, ...rest] = this.column(col).unique().values.sort();

                if (zero === 0 && one === 1 && (!rest || rest.length == 0)) {
                    this.types[col] = "boolean";
                }
            }
        }
    }


    public override copy(): ForgeFrame {
        const copied_frame = super.copy();
        const new_forge_frame = new ForgeFrame(copied_frame.values, {
            columns: copied_frame.columns,
        });

        new_forge_frame.initial_values = [...this.initial_values] as ArrayType1D | ArrayType2D;
        new_forge_frame.initial_columns = [...this.initial_columns];
        new_forge_frame.initial_dtypes = [...this.initial_dtypes];

        return new_forge_frame;
    }


    public reset(): void {
        // the set function order matters, values must be set before columns
        this.$setValues(this.initial_values, false, false);
        this.$setIndex([...Array(this.values.length).keys()]);
        this.$setColumnNames(this.initial_columns);

        this.$setDtypes(this.initial_dtypes);
        this.types = this.dtypesMap();

        if (this.binary_as_boolean) {
            this.binaryTypeAsBoolean();
        }
    }


    public override drop(options?: {
        columns?: string | Array<string>;
        index?: Array<string | number>;
        inplace?: boolean;
    }): ForgeFrame {
        if (options?.inplace) {
            super.drop(options);
            this.types = this.dtypesMap();
            return this;
        } else {
            const drop_df = super.drop(options);
            return new ForgeFrame(drop_df.values, { columns: drop_df.columns });
        }
    }


    /**
     * 
     * @param column   the dataframe column 
     * @param operator one of =, !=, <, <=, >, >=, startswith, endswith, contains, in, notin
     * @param value 
     * @returns 
     */
    public where(
        column: string,
        operator: "=" | "!=" | "<" | "<=" | ">" | ">=" | string,
        value: string | number | boolean | (string | number | boolean)[],
        { inplace }: { inplace?: boolean } = { inplace: false }) {

        if ((operator == "in" || operator == "notin") && !Array.isArray(value)) {
            throw Error(`ForgeFrame ParamError: "in" and "notin" operators required an array of values`);
        }

        const col_index: number = this.columns.indexOf(column);

        if (col_index == -1) {
            throw Error(`ForgeFrame ParamError: '${column}' not found in ${this.columns}`);
        }

        const type = this.ctypes.at(column);

        // convert value to its proper column type
        if (type == "string") {
            value = Array.isArray(value) ? value.map(item => item.toString()) : value.toString();
        } else if (type == "boolean") {
            value = Array.isArray(value)
                ? value.map(item => item.toString().toLowerCase() === "false" ? false : true)
                : value.toString().toLowerCase() === "false" ? false : true;
        } else {
            value = Array.isArray(value) ? value.map(item => Number(item)) : Number(value);
        }

        const new_values: ArrayType2D = [];

        switch (operator) {
            case "=": {
                for (let i = 0; i < this.values.length; i++) {
                    if ((this.values[i] as any)[col_index] == value) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "!=": {

                for (let i = 0; i < this.values.length; i++) {
                    if ((this.values[i] as any)[col_index] != value) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "startswith": {
                for (let i = 0; i < this.values.length; i++) {
                    if (String(this.iat(i, col_index)).startsWith(value as string)) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "endswith": {
                for (let i = 0; i < this.values.length; i++) {
                    if (String(this.iat(i, col_index)).endsWith(value as string)) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "contains": {
                for (let i = 0; i < this.values.length; i++) {
                    if (String(this.iat(i, col_index)).includes(value as string)) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "notcontains": {
                for (let i = 0; i < this.values.length; i++) {
                    if (!String(this.iat(i, col_index)).includes(value as string)) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "<": {
                for (let i = 0; i < this.values.length; i++) {
                    if ((this.values[i] as any)[col_index] < value) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "<=": {
                for (let i = 0; i < this.values.length; i++) {
                    if ((this.values[i] as any)[col_index] <= value) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case ">": {
                for (let i = 0; i < this.values.length; i++) {
                    if ((this.values[i] as any)[col_index] > value) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case ">=": {
                for (let i = 0; i < this.values.length; i++) {
                    if ((this.values[i] as any)[col_index] >= value) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "in": {
                const possible = new Set(value as (string | number | boolean)[]);

                for (let i = 0; i < this.values.length; i++) {
                    if (possible.has((this.values[i] as any)[col_index])) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }

                break;
            }

            case "notin": {
                const not_allowed = new Set(value as (string | number | boolean)[]);

                for (let i = 0; i < this.values.length; i++) {
                    if (!not_allowed.has((this.values[i] as any)[col_index])) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "empty": {
                for (let i = 0; i < this.values.length; i++) {
                    if (!this.iat(i, col_index) && this.iat(i, col_index) != false) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            case "notempty": {
                for (let i = 0; i < this.values.length; i++) {
                    if (this.iat(i, col_index) || this.iat(i, col_index) == false) {
                        new_values.push(this.values[i] as string[] | number[] | boolean[] | (string | number | boolean)[]);
                    }
                }
                break;
            }

            default:
                throw Error(`ForgeFrame ParamError: '${operator}' is not a valid operator`);
        }

        if (inplace) {
            // overwrite dataframe's internal data with the filtered data, no dimension checks
            this.$setValues(new_values, false, false);
            this.$setIndex([...Array(new_values.length).keys()])
            return this;
        } else {
            return new ForgeFrame(new_values, { columns: this.columns });
        }
    }


    /**
     * Create a concatenation of string columns as a new column
     * 
     * @param columns   An array of column names to be concatenated
     * @param props.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
     * @param props.colname Name of the concatenated column
     * @param props.separator Character or string to join the columns. Defaults to a single space
     * @returns 
     */
    public concatColumns(columns: string[], props?: {
        inplace?: boolean;
        colname?: string;
        separator?: string;
    }): ForgeFrame {
        const { inplace = false, colname = columns.join("_"), separator = " " } = props ? props : {};

        if (colname && this.columns.includes(colname)) {
            throw Error(`ForgeFrame.concatColumns ParamError: ${colname} already exists as a column`);
        }

        if (columns.length < 2) {
            throw Error(`ForgeFrame.concatColumns ParamError: at least 2 columns are required`);
        }

        const new_col: string[] = [];
        const col_indices: number[] = [];

        // check that columns exist in current dataframe and get their index
        for (const col of columns) {
            const index = this.columns.indexOf(col);

            if (index != -1) {
                col_indices.push(index);
            } else {
                throw Error(`ForgeFrame.concatColumns ParamError: ${col} is not one of [${this.columns}]`);
            }
        }

        for (let row = 0; row < this.shape[0]; row++) {
            const concat: any[] = [];

            for (const col of col_indices) {
                concat.push(this.iat(row, col));
            }

            new_col.push(concat.join(separator));
        }

        if (inplace) {
            this.addColumn(colname, new_col, { inplace: true });
            this.types = this.dtypesMap();
            return this;
        } else {
            this.addColumn(colname, new_col, { inplace: false });
            return this.copy();
        }
    }


    public rearrange({ columns, inplace = false }: {
        columns: string[];
        inplace?: boolean;
    }): ForgeFrame {
        if (columns.toSorted().toString() != this.columns.toSorted().toString()) {
            throw Error(`ForgeFrame.rearrange ParamError: the rearranged columns do not match the dataframe columns`);
        } else if (columns.toString() == this.columns.toString()) {
            return inplace ? this : this.copy();
        }

        const new_column_order = columns.map(col => this.columns.indexOf(col));
        const rearranged = this.iloc({ rows: [":"], columns: new_column_order });

        if (inplace) {
            this.$setValues(rearranged.values, false, false);
            this.$setIndex([...Array(rearranged.values.length).keys()])
            this.$setColumnNames(rearranged.columns);
            return this;
        } else {
            return new ForgeFrame(rearranged.values, { columns: rearranged.columns });
        }
    }


    /**
     * Drop all empty rows, for cases such as source data having rows with missing values.
     */
    public dropNaRows({ inplace = false }: {
        inplace?: boolean;
    }) {
        const bad_rows: number[] = [];

        for (let i = 0; i < this.shape[0]; i++) {
            if ((this.values[i] as []).length != this.columns.length) {
                bad_rows.push(i);
            }
        }

        if (inplace) {
            this.drop({ index: bad_rows, inplace: true });
            this.dropNa({ axis: 1, inplace: true });
            return this;
        } else {
            const cleaned = this.copy();
            cleaned.drop({ index: bad_rows, inplace: true });
            cleaned.dropNa({ axis: 1, inplace: true });
            return cleaned;
        }
    }


    /**
     * Converts boolean values to 0 and 1 and each row does
     * not have an undefined value.
     * 
     * @returns dataframe's values
     */
    public dataset() {
        const copy = this.copy();
        copy.dropNaRows({ inplace: true });
        copy.dropNa({ axis: 1, inplace: true }); // drop rows that contain an undefined value

        for (let i = 0; i < copy.dtypes.length; i++) {
            if (copy.dtypes[i] == "boolean") {
                // convert boolean to 0s and 1s
                copy.asType(copy.columns[i], "float32", { inplace: true });
            }
        }

        return copy.values;
    }


    /**
     * Returns the column to data type mapping. This simplifies iterating
     * over the dataframe columns and dtypes separately
     */
    public dtypesMap() {
        return Object.fromEntries(this.columns.map(
            (col, index) => [this.columns[index], this.dtypes[index]])) as DataTypes;
    }
}


// https://stackoverflow.com/questions/31054910/get-functions-methods-of-a-class
function getDataFrameProperties(object: any) {
    const methods = new Set();

    while (object = Reflect.getPrototypeOf(object)) {
        const keys = Reflect.ownKeys(object)
        keys.forEach((k) => methods.add(k));
    }
    return [...methods];
}


// The function names and properties of the dataframe class. Any dataset
// loaded into the dataframe cannot contain columns found here.
export const reserved_column_names = getDataFrameProperties(new ForgeFrame());
