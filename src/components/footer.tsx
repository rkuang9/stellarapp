export default function Footer() {

    return <footer className="flex justify-center items-center text-muted-foreground text-xs py-3 gap-1 container max-w-7xl mx-auto">
        <span>
            {`© ${new Date().getFullYear()} ${process.env.NEXT_PUBLIC_PROJECT_NAME}. All rights reserved.`}
        </span>
    </footer>
}
