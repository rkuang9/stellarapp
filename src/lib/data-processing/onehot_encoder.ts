import { OneHotEncoder as danfoOneHotEncoder } from "danfojs";
import { DataFrame } from "danfojs";
import type { Series } from "danfojs";
//import type Series from "danfojs/dist/danfojs-base/core/series";

// extends danfojs' OneHotEncoder with the added ability of loading pre-existing
/**
 * One hot encodes a DataFrame or matrix. This class extends Danfo.js's
 * OneHotEncoder class with the additions:
    - Use an existing set of unique values to one hot encode
    - Rename the transformed DataFrame's columns with the unique values
 */
export default class OneHotEncoder extends danfoOneHotEncoder {
    /**
     * @param mapping an array of unique values where their position the one-hot position
     */
    constructor(mapping?: string[]) {
        super();

        if (mapping) {
            this["$labels"] = mapping;
        }

        return this;
    }


    override transform(data: Array<string | number> | Series): DataFrame | number[][] {
        const result = super.transform(data);

        if (result instanceof DataFrame) {
            // rename the columns
            const cols = this["$labels"] as string[];

            result.rename(Object.fromEntries(cols.map((item, index) => [index, item])), { inplace: true })
        }

        return result;
    }



    /* restore(data: number[][]): string[] {
        const restored: string[] = [];

        for (const item of data) {
            if (item.length != this["$labels"].length) {
                throw new Error(`OneHotEncoder: Expected data length of ` +
                    `${this["$labels"].length}, received ${item.length}`);
            }

            let hot = -1;

            for (let i = 0; i < item.length; i++) {
                if (item[i] == 1) {
                    hot = i;
                }
            }

            if (hot != -1) {
                restored.push(this["$labels"][hot]);
            } else if (hot == -1 && this.trap) {
                restored.push(this.trap);
            } else {

            }
        }

        return restored;
    } */


    override fitTransform(data: Array<string | number> | any | Series) {
        if (!this["$labels"] || this["$labels"].length == 0) {
            this.fit(data);
        }

        return this.transform(data);
    }
}
