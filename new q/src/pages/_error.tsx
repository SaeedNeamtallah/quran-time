import type { NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

function ErrorPage({ statusCode }: ErrorProps) {
  return (
    <main className="error-shell">
      <h1>حدث خطأ</h1>
      <p>رمز الحالة: {statusCode ?? 500}</p>
      <style jsx>{`
        .error-shell {
          padding: 2rem;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
      `}</style>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
