"use client"

import React from "react";

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
//import vs from 'react-syntax-highlighter/dist/esm/styles/prism/vs'; // light theme

import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import py from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import "@/components/markdown/styles.css";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('python', py);
SyntaxHighlighter.registerLanguage('cpp', cpp);

// the "markdown" css class blocks Tailwind's css which causes extra
// width, nested bullets not rendering, and other styling problems

export function MarkdownEdit({
    content, placeholder, className, onChange, error = false, helper_text, id
}: {
    content: string;
    placeholder?: string;
    error?: boolean;
    helper_text?: string;
    className?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    id?: string;
}): React.JSX.Element {
    return <div className="flex flex-col grow gap-2">
        <Tabs defaultValue="edit" className="w-full grow">
            <TabsList>
                <TabsTrigger className="data-[state=active]:border-theme! data-[state=active]:text-theme!" value="edit">Edit</TabsTrigger>
                <TabsTrigger className="data-[state=active]:border-theme! data-[state=active]:text-theme!" value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex flex-col gap-2">
                <Textarea
                    id={`${id}-edit`}
                    value={content}
                    placeholder={placeholder}
                    className={`grow resize ${error ? "border-error" : ""} ${className}`}
                    onChange={onChange}
                />
                {helper_text && <span className={`text-xs ${error ? "text-error" : "text-muted-foreground"}`}>{helper_text}</span>}
            </TabsContent>


            <TabsContent value="preview" className="grow border rounded-lg p-3 bg-elevated">
                <Markdown id={`${id}-preview`} content={content ? content : placeholder ?? ""} />
            </TabsContent>
        </Tabs>
    </div>
}


export function Markdown({ content, id }: {
    content: string
    id?: string;
}): React.JSX.Element {
    // the "markdown" class comes from the accompanying styles.css which
    // reverts Tailwind's css that conflicts with ReactMarkdown
    return <div className="markdown" id={id}>
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
                code: ({ children, className, node, ...rest }) => {
                    const match = /language-(\w+)/.exec(className || "");

                    return match
                        ? <SyntaxHighlighter
                            language={match[1]}
                            style={vscDarkPlus}>
                            {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                        : <code {...rest} className={className}>
                            {children}
                        </code>
                }
            }}>
            {content}
        </ReactMarkdown >
    </div>
}
