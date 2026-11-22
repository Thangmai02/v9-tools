import { TopBar } from "@/components/top-bar";
import { Badge, cardClass } from "@/components/ui";

export function Waiting({
  name,
  email,
  avatarUrl,
  admin = false,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  admin?: boolean;
}) {
  return (
    <TopBar email={email} name={name} avatarUrl={avatarUrl} admin={admin}>
      <main className="h-full w-full overflow-y-auto px-4 py-10 sm:px-5 sm:py-14 lg:px-6 xl:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)] lg:gap-10">
          <section className={`${cardClass} p-6 sm:p-8`}>
            <Badge tone="amber">Gói thường</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Chào {name}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              Tài khoản đã có trên tool. Admin sẽ thấy tên và email của bạn. Khi được
              nâng Pro, bạn mở được bàn đăng bài neon và dùng mã khóa Facebook admin đã gắn.
            </p>
          </section>
          <section className={`${cardClass} p-6 sm:p-7`}>
            <p className="text-sm font-semibold text-ink">Tài khoản</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-muted">Tên</dt>
                <dd className="mt-1 font-medium text-ink">{name}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="mt-1 break-all font-medium text-ink">{email}</dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </TopBar>
  );
}
