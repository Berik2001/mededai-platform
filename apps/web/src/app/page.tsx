import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@med/ui";

const features = [
  {
    title: "ИИ-наставник по клинике",
    description: "Сократический наставник, который ведёт ваше клиническое мышление через реальные случаи.",
  },
  {
    title: "Адаптивные случаи",
    description: "Просматривайте и решайте случаи по специальностям и уровням сложности.",
  },
  {
    title: "Мгновенная обратная связь",
    description: "Отправляйте ответы в свободной форме и получайте структурированную оценку.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-6 py-12">
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          Медицинское образование на основе ИИ
        </span>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Осваивайте клиническое мышление — случай за случаем.
        </h1>
        <p className="max-w-xl text-lg text-slate-600">
          Практикуйтесь на реалистичных клинических случаях, получайте сократические подсказки
          от ИИ-наставника и отслеживайте свой прогресс по специальностям.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard">
            <Button size="lg">Начать</Button>
          </Link>
          <Link href="/cases">
            <Button size="lg" variant="outline">
              Просмотреть случаи
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </div>
  );
}
