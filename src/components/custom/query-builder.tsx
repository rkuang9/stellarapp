"use client"

import React from "react";

import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, FunnelPlus, Play, Plus, RefreshCcw, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDialogue } from "@/components/dialogue";


const operators: { [key: string]: string } = {
    "=": "is",
    "!=": "is not",
    "in": "is one of",
    "notin": "is not one of",
    "empty": "is empty",
    "notempty": "is not empty",
    "startswith": "starts with",
    "endswith": "ends with",
    "contains": "contains",
    "notcontains": "not contain",
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
};


export interface QueryDef {
    column?: string;
    operator?: string;
    value?: string | number;
}


export default function QueryBuilder({ columns, onChange, defaultQueries = [] }: {
    columns: string[];
    onChange: (query: QueryDef[]) => void;
    defaultQueries?: QueryDef[];
}) {
    const [queries, setQueries] = React.useState<QueryDef[]>(defaultQueries);
    const [minimized, setMinimized] = React.useState<boolean>(false);
    const last_query = React.useRef<QueryDef[]>([]);
    const { confirmation, Dialogue } = useDialogue();


    const onColumnChange = (index: number, column: string) => {
        queries[index].column = column;
        setQueries([...queries]);
    }

    const onOperatorChange = (index: number, operator: string) => {
        queries[index].operator = operator;
        setQueries([...queries]);
    }

    const onValueChange = (index: number, value: string) => {
        queries[index].value = value;
        setQueries([...queries]);
    }

    const onAdd = () => {
        setMinimized(false);
        setQueries([...queries, { column: undefined, operator: undefined, value: "" }]);
    }

    const onRemove = (remove_index: number) => {
        setQueries([...queries.filter((_, index) => index != remove_index)])
    }

    const onApply = () => {

        const cleaned_queries = queries.filter(query =>
            query.column !== undefined &&
            query.operator !== undefined &&
            query.value !== undefined);

        last_query.current = cleaned_queries;
        setQueries([...cleaned_queries]);
        setMinimized(true);
        onChange([...cleaned_queries]);
    };

    const onReset = () => {
        if (queries.length == 0) {
            return;
        }

        confirmation({ title: "Reset filters?", description: "Are you sure you want to reset the filter list?", yes: "Yes" }).then(answer => {
            if (answer) {
                setQueries([]);
                onChange([]);
            }
        })
    }

    const onMinimize = (new_minimize: boolean) => {
        if (new_minimize && queries.length == 0) {
            onAdd();
        }

        setMinimized(!minimized)
    };
    const operator_list = Object.keys(operators);

    const ApplyIcon = queries.length != 0 &&
        JSON.stringify(queries) == JSON.stringify(last_query.current)
        ? Check
        : Play;

    // animation for collapsible content
    // data-[state=open]:animate-in duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
    return <Collapsible open={!minimized && queries.length > 0} onOpenChange={onMinimize} className="flex flex-col gap-2">
        <Dialogue />

        <div className="query-builder-buttons-container flex flex-wrap gap-2">
            <CollapsibleTrigger asChild>
                <Button className="cursor-pointer" variant="outline" size="icon"><FunnelPlus /></Button>
            </CollapsibleTrigger>

            <Button className="cursor-pointer" variant="outline" onClick={onApply}><ApplyIcon className="text-theme" />Apply</Button>
            <Button className="cursor-pointer" variant="outline" onClick={onAdd}><Plus className="text-theme" />Add filter</Button>
            <Button className="cursor-pointer" variant="outline" onClick={onReset}><RefreshCcw className="text-error" />Reset</Button>
        </div>

        <CollapsibleContent className={`flex flex-col gap-2 `}>
            {queries.map((query, index) => (
                <div key={index} className="grid grid-cols-12 gap-2">
                    <div className="col-span-8 sm:col-span-4">
                        <Select
                            value={query.column ?? ""}
                            onValueChange={value => onColumnChange(index, value)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="column" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {columns.map((col, index) => <SelectItem key={index} value={col}>{col}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-4 sm:col-span-2">
                        <Select
                            defaultValue={operator_list[0]}
                            value={query.operator ?? ""}
                            onValueChange={value => onOperatorChange(index, value)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="operator" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {operator_list.map((op, index) => <SelectItem key={index} value={op}>{operators[op]}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
                        <Input
                            value={query.value ?? ""}
                            placeholder={query.operator == "in" || query.operator == "notin" ? "Comma,separated,values" : ""}
                            onChange={event => onValueChange(index, event.target.value)}
                            className="text-xs! placeholder:text-sm!" />

                        <Button variant="outline" size="icon" onClick={() => onRemove(index)}>
                            <X className="text-error" />
                        </Button>
                    </div>

                    {index != queries.length - 1 && <Separator className="block sm:hidden col-span-12" />}
                </div>
            ))}
        </CollapsibleContent>
    </Collapsible>
}
