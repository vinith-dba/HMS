import "./site-theme.css";
import { Navbar } from "@/components/marketing/navbar";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
import { Footer } from "@/components/marketing/footer";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="site">
      <SmoothScroll />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
