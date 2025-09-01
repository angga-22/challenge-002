"use client";

import type { NextPage } from "next";
import { MultiSendTool } from "./_components/MultiSendTool";
import { ErrorBoundary } from "./_components/ErrorBoundary";

const MultiSend: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5 w-full max-w-6xl">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">Multi-Send Tool</span>
            <span className="block text-2xl mb-2">Challenge 002 Solution</span>
            <span className="block text-lg opacity-70">Send ETH to multiple addresses in a single transaction</span>
          </h1>

          <ErrorBoundary>
            <MultiSendTool />
          </ErrorBoundary>
        </div>
      </div>
    </>
  );
};

export default MultiSend;
