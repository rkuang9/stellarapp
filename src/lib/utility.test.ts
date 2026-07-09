import * as util from "@/lib/utility";
import { ProjectType } from "@/types/project_types";

describe("utility functions", () => {
    it("should convert numbers to rounded human readable strings", async () => {
        expect(util.abbreviatedCount(0)).toBe("0");
        expect(util.abbreviatedCount(100)).toBe("100");

        expect(util.abbreviatedCount(1_234)).toBe("1.23k");

        expect(util.abbreviatedCount(1_234, 1)).toBe("1.2k");
        expect(util.abbreviatedCount(1_234, 2)).toBe("1.23k");
        expect(util.abbreviatedCount(1_234, 3)).toBe("1.234k");
        expect(util.abbreviatedCount(1_234, 4)).toBe("1.234k");

        expect(util.abbreviatedCount(12_345)).toBe("12.35k");
        expect(util.abbreviatedCount(12_345, 0)).toBe("12k");
        expect(util.abbreviatedCount(12_345, 1)).toBe("12.3k");
        expect(util.abbreviatedCount(12_345, 2)).toBe("12.35k");

        expect(util.abbreviatedCount(12_345_678)).toBe("12.35m");
        expect(util.abbreviatedCount(12_345_678, 0)).toBe("12m");
        expect(util.abbreviatedCount(12_345_678, 1)).toBe("12.3m");
        expect(util.abbreviatedCount(12_345_678, 2)).toBe("12.35m");
        expect(util.abbreviatedCount(12_345_678, 3)).toBe("12.346m");
    });


    it("should convert bytes to human readable file size strings", async () => {
        expect(util.readableFileSize(0)).toBe("0.00 B");
        expect(util.readableFileSize(Math.pow(1024, 1))).toBe("1.00 KB");
        expect(util.readableFileSize(Math.pow(1024, 1), 0)).toBe("1 KB");
        expect(util.readableFileSize(Math.pow(1024, 2))).toBe("1.00 MB");
        expect(util.readableFileSize(Math.pow(1024, 2), 0)).toBe("1 MB");
        expect(util.readableFileSize(Math.pow(1024, 3))).toBe("1.00 GB");
        expect(util.readableFileSize(Math.pow(1024, 3), 0)).toBe("1 GB");
        expect(util.readableFileSize(Math.pow(1024, 4))).toBe("1.00 TB");
        expect(util.readableFileSize(Math.pow(1024, 4), 0)).toBe("1 TB");
    });


    it("should not contain the word 'undefined' in any URL", async () => {
        expect(util.loginURL()).not.toContain("undefined");
        expect(util.loginURL("/new")).not.toContain("undefined");

        expect(util.userProfileURL("/new")).not.toContain("undefined");
        expect(util.modelProfileURL("username", "project_name")).not.toContain("undefined");
        expect(util.modelTrainingURLGeneric("username", "project_name")).not.toContain("undefined");

        // not testing baseURL and buildURL because jest can't
        // read environment variables without customisations
    });


    it("should return the index of the max value from a number array", async () => {
        expect(util.argMax([0])).toBe(0);
        expect(util.argMax([1])).toBe(0);
        expect(util.argMax([-1])).toBe(0);
        expect(util.argMax([])).toBe(-1);
        expect(util.argMax([Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY])).toBe(1);

        expect(util.argMax([-1, 0, 1])).toBe(2);
        expect(util.argMax([1, 0, -1])).toBe(0);
        expect(util.argMax([0, 1, -1])).toBe(1);
        expect(util.argMax([1, 1, 1])).toBe(0);

        expect(util.argMax([-10, -9, -8])).toBe(2);
        expect(util.argMax([-8, -9, -10])).toBe(0);

        expect(util.argMax([0, 1, 2])).toBe(2);
        expect(util.argMax([2, 1, 0])).toBe(0);

        expect(util.argMax([100, 1000, 9000])).toBe(2);
        expect(util.argMax([9000, 1000, 100])).toBe(0);
    });


    it("should util.clamp values to within the given min and max range", async () => {
        expect(util.clamp(-100, 0, 100)).toBe(0);
        expect(util.clamp(0, 1000, 100)).toBe(100);

        expect(util.clamp(0, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(0);
        expect(util.clamp(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
        expect(util.clamp(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);

        expect(util.clamp(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0)).toBe(0);
        expect(util.clamp(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
        expect(util.clamp(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);

        expect(util.clamp(-1000, -1000, 1000)).toBe(-1000);
        expect(util.clamp(-1000, 1000, 1000)).toBe(1000);

        expect(util.clamp(-1000, -500, 1000)).toBe(-500);
        expect(util.clamp(-1000, 500, 1000)).toBe(500);
    });


    it("should return a date string in yyyy-mm-dd hh:mm:ss format", async () => {
        const date_string = "2025-06-19 06:29:21";

        // if this test fails, change the utc hour from 13->14 or 14->13
        const date_string_utc = "2025-06-19 13:29:21";

        const date_string_no_time = "2025-06-19";
        const date_string_time_zeroes = "2025-06-19 00:00:00";

        // should become [ "2025", "06", "19", "06", "29", "21" ],
        // we can check the exact format by their string lengths
        {
            const date_as_string = util.toDateString(new Date(date_string))!;
            const [year, month, date, hour, min, sec] = date_as_string.split(/[- :]/);

            expect(date_as_string.toString().length).toBe(19);
            expect(year.toString().length).toBe(4);
            expect(month.toString().length).toBe(2);
            expect(date.toString().length).toBe(2);
            expect(hour.toString().length).toBe(2);
            expect(min.toString().length).toBe(2);
            expect(sec.toString().length).toBe(2);
        }

        {
            const date_as_string = util.toDateLocalString(new Date(date_string))!;
            const [year, month, date, hour, min, sec] = date_as_string.split(/[- :]/);

            expect(date_as_string.toString().length).toBe(19);
            expect(year.toString().length).toBe(4);
            expect(month.toString().length).toBe(2);
            expect(date.toString().length).toBe(2);
            expect(hour.toString().length).toBe(2);
            expect(min.toString().length).toBe(2);
            expect(sec.toString().length).toBe(2);
        }

        expect(util.toDateString()).toBeUndefined();
        expect(util.toDateLocalString()).toBeUndefined();
    });


    it("should detect external href URLs", async () => {
        const username = "test_username";
        const project_name = "test_project_name";

        const internal_urls = [
            "google.com",
            "/google.com",
            util.userProfileURL(username),
            util.userProfileModelsURL(username),
            util.userProfileStarsURL(username),
            util.userProfileSettingsURL(username),
            util.modelProfileURL(username, project_name),
            util.modelSettingsURL(username, project_name),
            util.modelTrainingURLGeneric(username, project_name),
            util.searchModelsURL(),
            util.newModelURL(),
            util.modelTrainingURL(username, project_name, ProjectType.TABULAR_REGRESSION),
            util.modelServingURL(username, project_name, ProjectType.TABULAR_REGRESSION),
            util.absoluteURL(username),
        ]

        const external_urls = [
            "https://google.com",
            "http://google.com",
            "//google.com",
            "ftp://whatever"
        ]

        for (const url of internal_urls) {
            expect(util.isInternalURL(url)).toBe(true);
        }

        for (const url of external_urls) {
            expect(util.isInternalURL(url)).toBe(false);
        }
    });
});
