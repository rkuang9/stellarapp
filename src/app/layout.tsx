import "./globals.css";

import { Metadata } from "next";


export const metadata: Metadata = {
	title: `${process.env.NEXT_PUBLIC_PROJECT_NAME} | Create and Run AI in the Browser`,
	description: 'Train and run AI models in your browser with just a few clicks. No code, no cloud, no uploads. Everything stays on your device.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {

	return <html lang="en">
		<body className="dark bg-background-page!">
			{children}
		</body>
	</html>

}
