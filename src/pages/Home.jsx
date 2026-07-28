import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Hero from "../sections/Hero.jsx";
import HowItWorks from "../sections/HowItWorks.jsx";
import Pricing from "../sections/Pricing.jsx";
import About from "../sections/About.jsx";
import Contact from "../sections/Contact.jsx";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Pricing />
        <About />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
