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
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_10px_28px_rgba(27,25,20,0.05)]">
            <p className="text-sm font-semibold text-ink">Về chúng tôi</p>
            <div className="mt-3 space-y-4 text-sm leading-7 text-muted">
              <p>
                Chúng tôi là một tập thể anh em trẻ, đầy nhiệt huyết, cùng làm việc và
                phát triển trong lĩnh vực quảng cáo trên Facebook. Xuất phát từ những
                trải nghiệm thực tế trong quá trình chạy quảng cáo, quản lý Fanpage và
                vận hành công việc hằng ngày, chúng tôi hiểu rằng thời gian và hiệu suất
                chính là yếu tố quan trọng để phát triển.
              </p>
              <p>
                Với tinh thần{" "}
                <strong className="font-semibold text-ink">
                  không ngừng học hỏi, đổi mới và tối ưu
                </strong>
                , chúng tôi cùng nhau xây dựng{" "}
                <strong className="font-semibold text-ink">V9 Tools</strong> – một công
                cụ giúp đơn giản hóa các thao tác lặp lại, nâng cao hiệu suất và từng
                bước chuyên nghiệp hóa quy trình làm việc.
              </p>
              <p>
                Chúng tôi không chỉ muốn tạo ra một công cụ tiện ích, mà còn hướng đến
                việc xây dựng một hệ thống làm việc{" "}
                <strong className="font-semibold text-ink">
                  thông minh hơn, nhanh hơn và hiệu quả hơn
                </strong>
                , để anh em có thể tập trung thời gian vào những ý tưởng, chiến lược và
                mục tiêu lớn hơn.
              </p>
              <p className="font-semibold text-ink">
                V9 Tools – Được xây dựng từ trải nghiệm thực tế, phát triển bằng đam mê
                và tinh thần không ngừng cải tiến.
              </p>
            </div>
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
