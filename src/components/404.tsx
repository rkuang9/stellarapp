import Link from "next/link";

import NavBar from "@/components/navbar";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";


export default function NotFound({ children }: {
    children?: React.ReactNode
}) {
    return <div className="h-screen flex flex-col">
        <NavBar sticky={false} />

        <div className="flex flex-col grow justify-center items-center">
            {children ? children : <div className="flex flex-col gap-5 items-center">
                <span className="text-3xl">404 | Page Not Found</span>

                <Link href="/" prefetch={false}>
                    <Button className="bg-theme">Return home</Button>
                </Link>
            </div>}
        </div>

        <Footer />
    </div>
}