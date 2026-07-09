import prisma from "@/lib/database/prisma";

export const getProjectConfig = async (username: string, project_name: string, branch: string) => {
    return await prisma.project_configs.findFirst({
        where: {
            project_parents: {
                username,
                project_name,
            },
            branch,
        },
        // some columns that aren't ommitted and don't exist in ProjectConfig
        // (e.g. saved_model) will be excluded when instantiating it
        omit: {
            created_at: true,
            updated_at: true,
            created_by: true,
            updated_by: true,
            id: true,
            branch: true,
            project_parent: true,
        }
    });
}


export const getLlmConfig = async (username: string, project_name: string, branch: string) => {
    return await prisma.llm_configs.findFirst({
        where: {
            project_parents: {
                username,
                project_name,
            },
            branch,
        },
        // some columns that aren't ommitted and don't exist in ProjectConfig
        // (e.g. saved_model) will be excluded when instantiating it
        omit: {
            created_at: true,
            updated_at: true,
            created_by: true,
            updated_by: true,
            id: true,
            branch: true,
            project_parent: true,
        }
    });
}


export const getProjectParent = async (username: string, project_name: string) => {
    return await prisma.project_parents.findUnique({
        where: { project_name_username: { username, project_name } },
        select: {
            id: true,
            project_name: true,
            public_access: true,
            project_type: true,
            about: true,
            username: true
        },
    });
}