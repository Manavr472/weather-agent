import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChatInterface from "./ChatInterface";

jest.mock("../hooks/useWeatherAgent", () => {
  return jest.fn(() => ({
    responseChunks: [],
    loading: false,
    error: null,
    sendRequest: jest.fn(),
  }));
});

describe("ChatInterface", () => {
  it("renders chat messages", () => {
    render(<ChatInterface />);

    expect(screen.getByText("Hello! How can I assist you today?")).toBeInTheDocument();
    expect(screen.getByText("I need help with my account.")).toBeInTheDocument();
  });

  it("sends input and displays user message", () => {
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Type your message...");
    const sendButton = screen.getByText("Send");

    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(sendButton);

    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("displays loading state", () => {
    jest.mock("../hooks/useWeatherAgent", () => {
      return jest.fn(() => ({
        responseChunks: [],
        loading: true,
        error: null,
        sendRequest: jest.fn(),
      }));
    });

    render(<ChatInterface />);

    expect(screen.getByText("Typing...")).toBeInTheDocument();
  });

  it("displays error state", () => {
    jest.mock("../hooks/useWeatherAgent", () => {
      return jest.fn(() => ({
        responseChunks: [],
        loading: false,
        error: "Network error",
        sendRequest: jest.fn(),
      }));
    });

    render(<ChatInterface />);

    expect(screen.getByText("Error: Network error")).toBeInTheDocument();
  });
});
