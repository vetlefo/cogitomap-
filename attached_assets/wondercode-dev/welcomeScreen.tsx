import React, { useState, useEffect, useRef } from "react";
import useStore from "../../store/useStore";
import { Button } from "@/components/ui/button";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  Code2,
  Zap,
  Rocket,
  Brain,
  NetworkIcon,
  Workflow,
  ArrowRight,
  Sparkles,
  MousePointer,
  ChevronDown,
  Check,
  Star,
  Github,
  Cpu,
  Wand2,
} from "lucide-react";
import wcTransparent from "../../../wc-transparent.png";

import { CURRENT_VERSION } from "@/licenseverification/currentVersion";

interface WelcomeScreenProps {
  changelog?: string[];
  onFinish?: () => void;
}

export default function WelcomeScreen({
  changelog,
  onFinish,
}: WelcomeScreenProps) {
  const setShouldShowWelcome = useStore((state) => state.setShouldShowWelcome);
  const setAppVersion = useStore((state) => state.setAppVersion);
  const [activeFeature, setActiveFeature] = useState<number>(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  // Adjusted opacity range so that the scroll indicator fades out immediately upon scrolling
  const opacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  // Mouse parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Define main features for the slider
  const mainFeatures = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Full Codebase Bridging",
      description:
        "Connect your entire project to advanced AI models with no context limitations",
      color: "from-blue-500 to-blue-700",
      bgColor:
        "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
    },
    {
      icon: <NetworkIcon className="w-8 h-8" />,
      title: "LLM Automation",
      description:
        "Seamlessly integrate with leading models for intelligent code assistance",
      color: "from-violet-500 to-violet-700",
      bgColor:
        "from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20",
    },
    {
      icon: <Workflow className="w-8 h-8" />,
      title: "One-Click Integration",
      description:
        "Apply AI-generated changes across your entire codebase instantly",
      color: "from-fuchsia-500 to-fuchsia-700",
      bgColor:
        "from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-900/20 dark:to-fuchsia-800/20",
    },
  ];

  // Auto-cycle through features every 4 seconds (cycling over mainFeatures for endless looping)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % mainFeatures.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [mainFeatures.length]);

  // Additional features for grid section
  const features = [
    ...mainFeatures,
    {
      icon: <Cpu className="w-8 h-8" />,
      title: "Advanced Code Analysis",
      description:
        "Deep understanding of your codebase structure, patterns and dependencies",
      color: "from-indigo-500 to-indigo-700",
      bgColor:
        "from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20",
    },
    {
      icon: <Wand2 className="w-8 h-8" />,
      title: "Intelligent Refactoring",
      description: "Automatic code improvements with robust error handling",
      color: "from-cyan-500 to-cyan-700",
      bgColor:
        "from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20",
    },
    {
      icon: <Github className="w-8 h-8" />,
      title: "Seamless Git Integration",
      description:
        "Create pull requests and manage branches directly within your workflow",
      color: "from-emerald-500 to-emerald-700",
      bgColor:
        "from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20",
    },
  ];

  // Background elements
  const glassShapes = [
    {
      size: 300,
      x: 10,
      y: 15,
      rotation: 15,
      color: "from-blue-400/20 to-purple-400/10",
    },
    {
      size: 200,
      x: 70,
      y: 30,
      rotation: -10,
      color: "from-purple-400/10 to-pink-400/20",
    },
    {
      size: 250,
      x: 50,
      y: 60,
      rotation: 20,
      color: "from-pink-400/15 to-blue-400/10",
    },
  ];

  // Particles for background animation
  const particles = Array(25)
    .fill(0)
    .map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * 5,
    }));

  const handleClickWelcome = () => {
    setShouldShowWelcome(false);
    setAppVersion(CURRENT_VERSION);
    if (onFinish) onFinish();
  };

  const calculateMouseParallax = (strength = 1) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const moveX = ((mousePosition.x - centerX) / 40) * strength;
    const moveY = ((mousePosition.y - centerY) / 40) * strength;
    return { x: moveX, y: moveY };
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-auto bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-gray-900 dark:to-blue-950"
    >
      {/* Glass morphism shapes in background */}
      {glassShapes.map((shape, i) => {
        const parallax = calculateMouseParallax(0.5);
        return (
          <motion.div
            key={i}
            className={`fixed rounded-full bg-gradient-to-br ${shape.color} backdrop-blur-xl pointer-events-none`}
            style={{
              width: shape.size,
              height: shape.size,
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              transform: `rotate(${shape.rotation}deg)`,
              filter: "blur(80px)",
              opacity: 0.6,
              zIndex: 0,
            }}
            animate={{
              x: parallax.x * (i + 1) * 0.5,
              y: parallax.y * (i + 1) * 0.5,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 100,
            }}
          />
        );
      })}

      {/* Background particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="fixed rounded-full bg-white dark:bg-blue-400/20 pointer-events-none"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            boxShadow: "0 0 10px rgba(255, 255, 255, 0.5)",
            zIndex: 0,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, 50, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
          }}
        />
      ))}

      {/* Header with scroll indicator */}
      <motion.div
        className=" top-0 left-0 right-0 z-30 flex justify-center"
        style={{ opacity }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="flex flex-col items-center mt-6 text-gray-400 dark:text-gray-500"
        >
          <span className="text-sm font-medium mb-2">Scroll to explore</span>
          <motion.div
            animate={{
              y: [0, 8, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Hero section */}
        <div
          ref={heroRef}
          className="min-h-screen relative flex flex-col items-center justify-center py-12 px-6 overflow-hidden"
        >
          <motion.div className="max-w-7xl w-full mx-auto" style={{ y }}>
            <div className="flex flex-col items-center justify-center mb-12">
              {/* Logo with effects */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  duration: 1.5,
                }}
                className="relative mb-6"
              >
                <motion.div
                  className="absolute inset-0 rounded-full blur-xl opacity-60"
                  animate={{
                    background: [
                      "radial-gradient(circle, rgba(59,130,246,0.6) 0%, rgba(147,51,234,0.3) 100%)",
                      "radial-gradient(circle, rgba(147,51,234,0.6) 0%, rgba(236,72,153,0.3) 100%)",
                      "radial-gradient(circle, rgba(236,72,153,0.6) 0%, rgba(59,130,246,0.3) 100%)",
                    ],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                />
                <img
                  src={wcTransparent}
                  alt="WonderCode Logo"
                  className="w-32 h-auto sm:w-40 relative z-10"
                />

                {/* Animated sparkles around logo */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-yellow-400"
                    initial={{
                      top: "50%",
                      left: "50%",
                      x: "-50%",
                      y: "-50%",
                      rotate: 0,
                      scale: 0,
                    }}
                    animate={{
                      rotate: [0, 360],
                      scale: [0, 1, 0],
                      x: ["-50%", `${Math.random() * 100 - 50}%`],
                      y: ["-50%", `${Math.random() * 100 - 50}%`],
                    }}
                    transition={{
                      duration: 2 + i,
                      repeat: Infinity,
                      delay: i * 0.5,
                    }}
                  >
                    <Sparkles className="w-6 h-6" />
                  </motion.div>
                ))}
              </motion.div>

              {/* Title with animation */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-center max-w-3xl"
              >
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-gradient-x">
                    WonderCode
                  </span>
                </h1>

                <div className="relative mb-8">
                  <motion.h2
                    className="text-2xl md:text-3xl text-gray-800 dark:text-gray-200 font-medium"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Your AI-Powered Coding Companion
                  </motion.h2>
                  <motion.div
                    className="absolute -right-12 -top-1"
                    animate={{
                      x: [0, 10, 0],
                      rotate: [0, 5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  >
                    <MousePointer className="w-5 h-5 text-purple-500" />
                  </motion.div>
                </div>

                <motion.p
                  className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  Seamlessly bridge your entire codebase to powerful AI models
                  and transform how you build software.
                </motion.p>

                {/* CTA button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleClickWelcome}
                    className="relative group px-10 py-7 rounded-xl font-medium text-lg shadow-xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 transition-all duration-300 group-hover:scale-105 animate-gradient-x"></div>
                    <span className="relative flex items-center z-10 text-white">
                      <Rocket className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                      <span>Launch WonderCode</span>
                      <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-white opacity-20 transition-all duration-300 group-hover:animate-shine"></div>
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          {/* 3D Hover Feature Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            style={{
              perspective: "1000px",
            }}
            className="w-full max-w-5xl mx-auto mt-4 px-4"
          >
            <AnimatePresence mode="wait">
              {features.slice(0, 3).map(
                (feature, index) =>
                  activeFeature === index && (
                    <motion.div
                      key={feature.title}
                      className="relative h-80 sm:h-96 w-full overflow-hidden rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/50 backdrop-blur-sm"
                      initial={{ opacity: 0, rotateX: 10 }}
                      animate={{
                        opacity: 1,
                        rotateX: 0,
                        y: [10, 0],
                      }}
                      exit={{ opacity: 0, rotateX: -10, y: -10 }}
                      transition={{ duration: 0.5 }}
                      style={{
                        transformStyle: "preserve-3d",
                        boxShadow:
                          "0 50px 100px -20px rgba(0, 0, 0, 0.1), 0 30px 60px -30px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      {/* Background with gradient */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-white/50 dark:from-gray-900/80 dark:to-gray-800/50 z-0" />

                      {/* Animated background pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.2) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255, 255, 255, 0.2) 2%, transparent 0%)",
                            backgroundSize: "100px 100px",
                            animation:
                              "gradientBackground 4s ease infinite alternate",
                          }}
                        />
                      </div>

                      {/* Glowing accent */}
                      <motion.div
                        className={`absolute h-1/2 w-1/2 rounded-full blur-3xl opacity-30 z-0`}
                        style={{
                          background: `linear-gradient(to right, ${feature.title.includes("Codebase") ? "#3b82f6" : feature.title.includes("LLM") ? "#8b5cf6" : "#ec4899"}, transparent)`,
                          top: "25%",
                          left: "5%",
                        }}
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.2, 0.3, 0.2],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          repeatType: "reverse",
                        }}
                      />

                      {/* Content */}
                      <div className="relative h-full z-10 flex flex-col justify-center p-8 sm:p-10 md:p-12">
                        <div className="flex items-center mb-6">
                          <div
                            className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg mr-5`}
                          >
                            {React.cloneElement(feature.icon, {
                              className: "text-white",
                            })}
                          </div>
                          <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300">
                            {feature.title}
                          </h3>
                        </div>

                        <p className="text-xl text-gray-700 dark:text-gray-200 max-w-2xl mb-6">
                          {feature.description}
                        </p>

                        <div className="flex gap-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center">
                              <Check className="w-5 h-5 text-green-500 mr-1" />
                              <span className="text-gray-600 dark:text-gray-400">
                                {i === 0
                                  ? "Lightning fast"
                                  : i === 1
                                    ? "Intuitive interface"
                                    : "Developer friendly"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3D element that moves with mouse */}
                      <motion.div
                        className="absolute right-10 bottom-10 z-10"
                        style={{
                          transformStyle: "preserve-3d",
                          transform: "translateZ(20px)",
                        }}
                        animate={{
                          x: calculateMouseParallax(3).x,
                          y: calculateMouseParallax(3).y,
                          rotateY: calculateMouseParallax(1).x * 0.05,
                          rotateX: -calculateMouseParallax(1).y * 0.05,
                        }}
                        transition={{
                          type: "spring",
                          damping: 25,
                          stiffness: 100,
                        }}
                      ></motion.div>
                    </motion.div>
                  ),
              )}
            </AnimatePresence>
          </motion.div>

          {/* Feature dots navigation */}
          <div className="flex justify-center gap-3 mt-6">
            {mainFeatures.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveFeature(idx)}
                className="group focus:outline-none"
                aria-label={`Switch to feature ${idx + 1}`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    activeFeature === idx
                      ? "bg-blue-600 dark:bg-blue-400 scale-125"
                      : "bg-gray-300 dark:bg-gray-600 scale-100 group-hover:bg-gray-400 dark:group-hover:bg-gray-500"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Features grid section */}
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, margin: "-100px" }}
              >
                Supercharge Your Development
              </motion.h2>
              <motion.p
                className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true, margin: "-100px" }}
              >
                A comprehensive suite of AI-powered tools designed to accelerate
                your workflow
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  whileHover={{ y: -5 }}
                  className="relative group cursor-pointer"
                  onClick={() => setActiveFeature(index % 3)}
                >
                  <div className="h-full p-8 rounded-2xl bg-white/90 dark:bg-gray-800/90 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden backdrop-blur-sm">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`}
                    />

                    <div className="relative z-10">
                      <div
                        className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} mb-6 shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300`}
                      >
                        {React.cloneElement(feature.icon, {
                          className: "text-white",
                        })}
                      </div>

                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                        {feature.title}
                      </h3>

                      <p className="text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors duration-300">
                        {feature.description}
                      </p>
                    </div>

                    <div className="relative mt-auto">
                      <div className="h-0.5 w-0 bg-blue-500 mt-6 group-hover:w-16 transition-all duration-300 ease-in-out" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Changelog section with glassmorphism */}
        {changelog && changelog.length > 0 && (
          <section className="py-16 px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/50 dark:to-purple-950/50 backdrop-blur-md z-0" />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="max-w-4xl mx-auto relative z-10"
            >
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl border border-white/50 dark:border-gray-700/50">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-12 h-12 rounded-full flex items-center justify-center shadow-lg">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                    What's New
                  </h2>
                </div>

                <div className="space-y-4">
                  {changelog.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      viewport={{ once: true, margin: "-100px" }}
                      className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                    >
                      <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-1 mt-0.5">
                        <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-gray-800 dark:text-gray-200">
                        {line}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {/* Footer with gradient */}
        <section className="py-16 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-50 to-transparent dark:from-blue-950/50 dark:to-transparent z-0" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
            className="max-w-5xl mx-auto text-center relative z-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Ready to Transform Your Development Workflow?
            </h2>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block mb-8"
            >
              <Button
                variant="default"
                size="lg"
                onClick={handleClickWelcome}
                className="relative group px-10 py-7 rounded-xl font-medium text-lg shadow-xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 transition-all duration-300 group-hover:scale-105"></div>
                <span className="relative flex items-center z-10 text-white">
                  <Rocket className="w-5 h-5 mr-2" />
                  <span>Get Started Now</span>
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Button>
            </motion.div>

            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              WonderCode — Designed with ❤️ for developers. <br />
              Native performance • Works with any codebase and LLM • Free to use
            </p>
          </motion.div>
        </section>

        {/* Add a subtle animation for css */}
        <style jsx>{`
          @keyframes gradientBackground {
            0% {
              background-position: 0% 0%;
            }
            100% {
              background-position: 100% 100%;
            }
          }

          @keyframes shine {
            from {
              left: -100%;
            }
            to {
              left: 200%;
            }
          }

          @keyframes animate-gradient-x {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }

          .animate-gradient-x {
            animation: animate-gradient-x 15s ease infinite;
            background-size: 400% 400%;
          }

          .group-hover\\:animate-shine:hover {
            animation: shine 1s;
          }
        `}</style>
      </div>
    </div>
  );
}
