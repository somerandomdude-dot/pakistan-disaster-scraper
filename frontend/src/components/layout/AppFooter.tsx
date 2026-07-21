import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="max-w-md">
            <h3 className="font-semibold text-slate-900 mb-1">Disaster Alert Pakistan</h3>
            <p className="text-sm text-slate-500">
              Unofficial third-party platform using publicly available official advisories. 
              Verify critical information through the original source.
            </p>
          </div>
          
          <div className="flex gap-4 text-sm text-slate-600">
            <Link href="/sources" className="hover:text-blue-600">Sources</Link>
            <Link href="/history" className="hover:text-blue-600">Alert History</Link>
            <Link href="#" className="hover:text-blue-600">About the Data</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
