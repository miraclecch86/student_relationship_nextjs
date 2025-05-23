'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Slide {
  id: number;
  title: string;
  description: string;
  link?: string;
  imageUrl?: string; // 이미지 URL 추가 (옵션)
  titleIcon?: React.ReactNode; // 제목 옆 아이콘 (옵션)
}

interface CarouselBannerProps {
  slides: Slide[];
  autoPlayInterval?: number; // 자동 넘김 간격 (ms), 0이면 자동 넘김 없음
}

const CarouselBanner: React.FC<CarouselBannerProps> = ({ slides, autoPlayInterval = 5000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? slides.length - 1 : prevIndex - 1
    );
  }, [slides.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === slides.length - 1 ? 0 : prevIndex + 1
    );
  }, [slides.length]);

  useEffect(() => {
    if (autoPlayInterval && autoPlayInterval > 0 && slides.length > 1) {
      const timer = setTimeout(() => {
        goToNext();
      }, autoPlayInterval);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, autoPlayInterval, slides.length, goToNext]);

  if (!slides || slides.length === 0) {
    return null;
  }

  const currentSlide = slides[currentIndex];

  // 애니메이션 설정
  const variants = {
    enter: (direction: number) => {
      return {
        x: direction > 0 ? 1000 : -1000,
        opacity: 0,
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => {
      return {
        zIndex: 0,
        x: direction < 0 ? 1000 : -1000,
        opacity: 0,
      };
    },
  };

  // 현재 슬라이드와 이전 슬라이드의 방향을 결정하기 위함
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    setPage([currentIndex + newDirection, newDirection]);
    if (newDirection > 0) {
        goToNext();
    } else {
        goToPrevious();
    }
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto overflow-hidden rounded-lg bg-blue-600 shadow-lg mt-2.5 mb-2.5 h-[170px] md:h-[210px]">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="absolute inset-0 py-6 md:py-8 px-14 md:px-16 flex flex-col justify-center items-start text-white"
          style={{ backgroundImage: currentSlide.imageUrl ? `url(${currentSlide.imageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className={`absolute inset-0 bg-blue-600 ${currentSlide.imageUrl ? 'opacity-60' : 'opacity-100'}`}></div>
          <div className="relative z-10 w-full">
            <h2 className="text-xl md:text-2xl font-bold mb-2 flex items-center">
              {currentSlide.titleIcon && <span className="mr-2">{currentSlide.titleIcon}</span>}
              {currentSlide.title}
            </h2>
            <p className="text-sm md:text-base mb-4">{currentSlide.description}</p>
            {currentSlide.link && (
              <Link href={currentSlide.link} className="text-sm md:text-base font-semibold text-white hover:text-blue-200 transition-colors duration-200 inline-flex items-center">
                자세히 보기 <ChevronRightIcon className="w-4 h-4 ml-1" />
              </Link>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="absolute top-1/2 left-3 md:left-4 transform -translate-y-1/2 bg-transparent hover:bg-gray-700 hover:bg-opacity-20 text-white p-2 rounded-full z-20 transition-all duration-200"
          >
            <ChevronLeftIcon className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute top-1/2 right-3 md:right-4 transform -translate-y-1/2 bg-transparent hover:bg-gray-700 hover:bg-opacity-20 text-white p-2 rounded-full z-20 transition-all duration-200"
          >
            <ChevronRightIcon className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all duration-300 ${
                  currentIndex === index ? 'bg-white scale-125' : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CarouselBanner; 