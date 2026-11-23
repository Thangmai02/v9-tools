export type AccessSnap = {
  pro: boolean;
  facebookKeyId: string | null;
  sourceName: string | null;
  pageCount: number;
};

export type AccessNote = {
  title: string;
  body: string;
};

export function accessChanges(prev: AccessSnap, next: AccessSnap): AccessNote[] {
  const notes: AccessNote[] = [];
  if (prev.pro !== next.pro) {
    notes.push(
      next.pro
        ? {
            title: "Đã cấp quyền Pro",
            body: "Tài khoản vừa được nâng Pro. Công cụ đã mở, không cần tải lại trang.",
          }
        : {
            title: "Đã gỡ quyền Pro",
            body: "Quyền Pro vừa được gỡ. Một số chức năng sẽ khóa lại.",
          },
    );
  }
  if (prev.facebookKeyId !== next.facebookKeyId) {
    notes.push(
      next.facebookKeyId
        ? {
            title: "Đã gán mã Facebook",
            body: next.sourceName
              ? `Bạn được dùng Fanpage từ ${next.sourceName}.`
              : "Danh sách Fanpage đã được cập nhật.",
          }
        : {
            title: "Đã gỡ mã Facebook",
            body: "Mã khóa Facebook không còn gán cho tài khoản này.",
          },
    );
  } else if (prev.pageCount !== next.pageCount || prev.sourceName !== next.sourceName) {
    notes.push({
      title: "Fanpage đã cập nhật",
      body:
        next.pageCount > prev.pageCount
          ? "Có Fanpage mới trong tài khoản."
          : "Danh sách Fanpage vừa thay đổi.",
    });
  }
  return notes;
}
