import {
  ChartLine,
  ChevronLeft,
  ChevronRight,
  Lock,
  PieChart,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '~/lib/utils'

interface Slide {
  icon: React.ReactNode
  titleKey: string
  descriptionKey: string
}

const SLIDES: Slide[] = [
  {
    icon: <ChartLine className="size-10" />,
    titleKey: 'waitlist.carousel.netWorthTitle',
    descriptionKey: 'waitlist.carousel.netWorthDescription',
  },
  {
    icon: <Lock className="size-10" />,
    titleKey: 'waitlist.carousel.encryptionTitle',
    descriptionKey: 'waitlist.carousel.encryptionDescription',
  },
  {
    icon: <Wallet className="size-10" />,
    titleKey: 'waitlist.carousel.bankTitle',
    descriptionKey: 'waitlist.carousel.bankDescription',
  },
  {
    icon: <PieChart className="size-10" />,
    titleKey: 'waitlist.carousel.analyticsTitle',
    descriptionKey: 'waitlist.carousel.analyticsDescription',
  },
  {
    icon: <RefreshCw className="size-10" />,
    titleKey: 'waitlist.carousel.cashFlowTitle',
    descriptionKey: 'waitlist.carousel.cashFlowDescription',
  },
]

const INTERVAL = 5000

export function WaitlistCarousel({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)
  const directionRef = useRef(1)
  const [_resetKey, setResetKey] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      directionRef.current = 1
      setDirection(1)
      setCurrent((prev) => (prev + 1) % SLIDES.length)
    }, INTERVAL)
    return () => clearInterval(timer)
  }, [])

  function resetTimer() {
    setResetKey((k) => k + 1)
  }

  function goTo(index: number) {
    const dir = index > current ? 1 : -1
    directionRef.current = dir
    setDirection(dir)
    setCurrent(index)
    resetTimer()
  }

  function prev() {
    directionRef.current = -1
    setDirection(-1)
    setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length)
    resetTimer()
  }

  function next() {
    directionRef.current = 1
    setDirection(1)
    setCurrent((c) => (c + 1) % SLIDES.length)
    resetTimer()
  }

  const slide = SLIDES[current]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-8',
        className,
      )}
    >
      <div className="flex items-center gap-6">
        <button
          type="button"
          aria-label="Previous slide"
          onClick={prev}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ChevronLeft className="size-5" />
        </button>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            initial={{ opacity: 0, y: 20 * directionRef.current }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 * directionRef.current }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex max-w-md flex-col items-center gap-4 text-center"
          >
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {slide.icon}
            </div>
            <h2 className="text-2xl font-bold">{t(slide.titleKey)}</h2>
            <p className="text-balance text-muted-foreground">
              {t(slide.descriptionKey)}
            </p>
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          aria-label="Next slide"
          onClick={next}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.titleKey}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              i === current ? 'w-6 bg-primary' : 'w-2 bg-primary/20',
            )}
          />
        ))}
      </div>
    </div>
  )
}
