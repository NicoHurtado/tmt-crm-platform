import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import ServicesCarousel from '@/components/landing/ServicesCarousel';
import HowItWorks from '@/components/landing/HowItWorks';
import Testimonials from '@/components/landing/Testimonials';
import CallToAction from '@/components/landing/CallToAction';
import Footer from '@/components/landing/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';

export default function Home() {
    return (
        <main className="min-h-screen">
            <Header />
            <Hero />
            <Features />
            <HowItWorks />
            <ServicesCarousel />
            <Testimonials />
            <CallToAction />
            <Footer />
            <WhatsAppButton />
        </main>
    );
}
