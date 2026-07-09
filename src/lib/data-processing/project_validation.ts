/*
    This file should be client and server agnostic
*/

import ProjectTypes from "@/types/project_types";


export const PROJECT_NAME_MIN_LENGTH = 1;
export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 10_000;
export const PROJECT_ABOUT_MAX_LENGTH = 350;
//export const PROJECT_NAME_REGEX = /^(?!-.)(?!.*--)(?!.*\.\.)[A-Za-z0-9-_.]+(?<!-)(?<!\.)$/;
// regex for allowing alphanumeric, underscore, period, hyphen only
// do not add the global flag /g, https://stackoverflow.com/questions/1520800/why-does-a-regexp-with-global-flag-give-wrong-results
export const PROJECT_NAME_REGEX = /^[a-zA-Z\d-_.]+$/;
export const PROJECT_NAME_LENGTH_ERROR_MSG = `Project name should be between ${PROJECT_NAME_MIN_LENGTH} and ${PROJECT_NAME_MAX_LENGTH} characters`;
export const PROJECT_NAME_REGEX_ERROR_MSG = `Project name should contain only ASCII letters, digits, periods, hyphens, and underscores`;



export function validateProjectName(project_name: string): string | null {
    if (project_name.length < PROJECT_NAME_MIN_LENGTH ||
        project_name.length > PROJECT_NAME_MAX_LENGTH ||
        !PROJECT_NAME_REGEX.test(project_name)) {
        return `The project name should be ${PROJECT_NAME_MIN_LENGTH} - ${PROJECT_NAME_MAX_LENGTH}` +
            ` characters long and contain only ASCII letters, digits, periods, hyphens, and underscores.`
    }

    return null;
}


export function validateProjectDescription(project_description?: string): string | null {
    if (!project_description || project_description.length == 0) {
        return null;
    }

    if (project_description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
        return `Project description should be under ${PROJECT_DESCRIPTION_MAX_LENGTH} characters.`;
    }

    return null;
}


export function validateProjectAbout(about?: string): string | null {
    if (!about) {
        return null;
    }

    if (about.length > PROJECT_ABOUT_MAX_LENGTH) {
        return `The project's short description should be under ${PROJECT_ABOUT_MAX_LENGTH} characters.`;
    }

    return null;
}


export function validateProjectType(project_type: string): string | null {
    if (project_type === "") {
        return "Pick a project type";
    }

    if (!ProjectTypes[project_type] || !ProjectTypes[project_type].available) {
        return `Invalid project type`;
    }

    return null;
}
