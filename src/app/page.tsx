import Image from "next/image";
import ChatInterface from "../components/ChatInterface";

export default function Home() {
  return (
    <div className="min-h-screen h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex items-center justify-center py-2">
      <div className="container mx-auto max-w-4xl h-screen max-h-[calc(100vh-1rem)] p-0 md:p-2">
        <div className="h-full overflow-hidden rounded-none md:rounded-xl md:shadow-xl flex flex-col">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
