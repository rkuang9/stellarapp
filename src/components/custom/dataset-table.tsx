"use client"

import React from "react";

import {
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableRow,
} from "@/components/ui/table"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";


export function DatasetTable({ columns, data, maxRows = 100 }: {
    columns?: string[];
    data: { [key: string]: any }[];
    maxRows?: number;
}) {
    const [page, setPage] = React.useState<number>(0);
    const cols = columns ?? (data && data.length > 0 ? Object.keys(data[0]) : []);

    return (
        <div className="border rounded-md overflow-auto w-full flex flex-col gap-2">
            <table className="table-auto w-full text-sm overflow-auto text-muted-foreground">
                <thead className="sticky top-0 bg-background-page">
                    <TableRow>
                        {cols.map((col, index) => <TableHead key={index}>{col}</TableHead>)}
                    </TableRow>
                </thead>

                <TableBody className="overflow-auto">
                    {data.map((row, row_index) => (<TableRow key={row_index}>
                        {cols.map((col, col_index) => <TableCell key={col_index}>{row[col]}</TableCell>)}
                    </TableRow>))}
                </TableBody>
            </table>

            <Pagination className="sticky bottom-0 bg-background-page p-1! justify-end">
                <PaginationContent className="gap-2">
                    <PaginationItem>
                        <span className="text-muted-foreground text-xs px-2">{page + 1} / {Math.ceil(data.length / maxRows)}</span>
                    </PaginationItem>

                    <PaginationItem>
                        <Button id="dataset-table-previous" variant="ghost" className="hover:bg-elevated! text-muted-foreground"><ChevronLeft /></Button>
                    </PaginationItem>

                    <PaginationItem>
                        <Button id="dataset-table-next" variant="ghost" className="hover:bg-elevated! text-muted-foreground"><ChevronRight /></Button>
                    </PaginationItem>

                </PaginationContent>
            </Pagination>
        </div>
    )
}
