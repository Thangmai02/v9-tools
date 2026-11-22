import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { shellClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Tạo tài khoản",
    text: "Nhân viên đăng ký bằng email. Tab Tool chỉ mở sau khi đăng nhập.",
  },
  {
    title: "Admin gắn mã",
    text: "Mã khóa Facebook do admin nhập và đổi. Người dùng không thấy ô này.",
  },
  {
    title: "Soạn và đăng",
    text: "Chọn nhiều Page, viết một bài, tool đăng lần lượt và ghi nhật ký.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className={`${shellClass} grid gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center xl:gap-16`}>
          <div>
            <p className="text-sm font-semibold text-pine">Nội dung cho nhiều Fanpage</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl xl:text-6xl">
              Một bài viết, nhiều Page, một nơi theo dõi.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted xl:text-lg xl:leading-8">
              V9 Tools là bàn làm việc cho đội nội dung. Admin giữ mã khóa Facebook.
              Nhân viên đăng nhập, chọn Page và đăng bài công khai.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tool"
                className="inline-flex h-11 items-center rounded-lg bg-moss px-5 text-sm font-semibold text-white hover:bg-moss-dark"
              >
                Bắt đầu ngay
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-pine/40"
              >
                Tạo tài khoản
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_10px_28px_rgba(27,25,20,0.05)]">
            <p className="text-sm font-semibold text-ink">Về chúng tôi</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              Chúng tôi làm công cụ cho nhóm nhỏ đăng bài lên Fanpage hằng ngày: lịch
              đăng rõ, khoảng cách giữa các Page, và nhật ký Page nào đã lên. Mã kết
              nối Facebook nằm ở trang admin, để nhân viên chỉ việc soạn nội dung.
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-ink">
              <li>Đăng chữ, link hoặc một ảnh.</li>
              <li>Chọn nhiều Page trong một đợt.</li>
              <li>Bài gửi công khai, ai xem Page cũng thấy.</li>
            </ul>
          </div>
        </section>

        <section className="border-t border-line bg-card/35 backdrop-blur-[1px]">
          <div className={`${shellClass} grid gap-4 py-14 md:grid-cols-3 xl:gap-6`}>
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-line bg-card p-5">
                <p className="text-sm font-semibold text-pine">0{index + 1}</p>
                <h2 className="mt-2 text-lg font-semibold text-ink">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
