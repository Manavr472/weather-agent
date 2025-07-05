"use client"
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import useWeatherAgent from "../hooks/useWeatherAgent";
// Import CSS for markdown styling directly in globals.css instead

// Thread ID management - Could be moved to a utility file
const THREAD_ID_KEY = "weather_agent_thread_id";
const getThreadId = () => {
  // Use college roll number or generate a UUID if not available
  return localStorage.getItem(THREAD_ID_KEY) || `thread-${Date.now()}`;
};

const saveThreadId = (threadId: string) => {
  localStorage.setItem(THREAD_ID_KEY, threadId);
};

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; timestamp?: Date }>>([
    { 
      sender: "agent", 
      text: "Hello! I'm your weather assistant. You can:\n\n- Type a **city name** like 'New York' or 'Paris'\n- Ask a question like 'What's the weather in Tokyo?'\n- Request a forecast with 'Will it rain in London tomorrow?'\n\nHow can I help you today?",
      timestamp: new Date()
    },
  ]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("light");
  const [threadId, setThreadId] = useState("");
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const lastResponseRef = useRef<string>("");

  // Initialize thread ID on component mount
  useEffect(() => {
    const currentThreadId = getThreadId();
    setThreadId(currentThreadId);
    saveThreadId(currentThreadId);

    // Load saved messages for this thread (if any)
    const savedMessages = localStorage.getItem(`messages_${currentThreadId}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    const storedTheme = localStorage.getItem("theme") || "light";
    setTheme(storedTheme);
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    if (threadId && messages.length > 0) {
      localStorage.setItem(`messages_${threadId}`, JSON.stringify(messages));
    }
  }, [messages, threadId]);

  // Create the hook with message history
  const { responseChunks, loading, error, sendRequest: originalSendRequest } = useWeatherAgent({
    messageHistory: messages.filter(msg => msg.sender !== "system"),
    threadId: threadId,
    apiUrl: "https://brief-thousands-sunset-9fcb1c78-485f-4967-ac04-2759a8fa1462.mastra.cloud/api/agents/weatherAgent/stream",
  });

  // Improved helper function to detect different types of messages
  const detectMessageType = (message: string): 'greeting' | 'location' | 'weather_question' | 'general_weather' | 'conversation' => {
    // Normalize the message for checking
    const normalizedMsg = message.toLowerCase().trim();
    
    // Common greetings patterns
    const greetingPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)( there)?[!.?]?$/,
      /^(how are you|how's it going|what's up|how do you do)[?!.]*$/
    ];
    
    // Weather-related question patterns that likely contain a location
    const weatherQuestionPatterns = [
      /weather in/i,
      /temperature in/i,
      /forecast for/i,
      /rain in/i,
      /snow in/i,
      /sunny in/i,
      /cloudy in/i,
      /how (hot|cold|warm) is it in/i,
      /what'?s the weather (like |in |at )/i,
    ];
    
    // Check if it's a general weather question (without location)
    if (isGeneralWeatherQuestion(normalizedMsg)) {
      return 'general_weather';
    }

    // Check if it's a greeting
    if (greetingPatterns.some(pattern => pattern.test(normalizedMsg))) {
      return 'greeting';
    }
    
    // Check if it contains weather-related terms with location
    if (weatherQuestionPatterns.some(pattern => pattern.test(normalizedMsg))) {
      return 'weather_question';
    }
    
    // Check for any weather-related terms
    const anyWeatherTerms = [
      /weather/i,
      /temperature/i,
      /forecast/i,
      /rain/i,
      /snow/i,
      /sunny/i,
      /cloudy/i,
      /wind/i,
      /humidity/i,
      /precipitation/i,
      /climate/i,
    ];
    
    if (anyWeatherTerms.some(pattern => pattern.test(normalizedMsg))) {
      return 'weather_question';
    }

    // Check if it seems like just a city name (simple heuristic)
    const isCityLike = /^[A-Za-z\s\-',.]+$/.test(normalizedMsg) && 
                      normalizedMsg.split(/\s+/).length <= 3 &&
                      !/^\d+$/.test(normalizedMsg);  // Not just numbers
    
    if (isCityLike) {
      return 'location';
    }
    
    // Default to conversation
    return 'conversation';
  };

  const sendMessage = () => {
    if (input.trim() && !loading) {
      const userInput = input.trim();
      
      // Detect the type of message
      const messageType = detectMessageType(userInput);
      
      // Create the message to display in UI (original input) with timestamp
      const displayMessage = { 
        sender: "user", 
        text: userInput,
        timestamp: new Date()
      };
      
      // Create the message to send to API (enhanced for city names)
      let apiMessage: { sender: string; text: string };
      let addHelperMessage = false;
      
      // Format message according to its type
      switch (messageType) {
        case 'location':
          apiMessage = { 
            sender: "user", 
            text: `What's the weather in ${userInput}?` 
          };
          break;
          
        case 'greeting':
          apiMessage = { 
            sender: "user", 
            text: userInput + " I'd like to know about the weather." 
          };
          break;
        
        case 'general_weather':
          apiMessage = { 
            sender: "user", 
            text: userInput 
          };
          addHelperMessage = true;
          break;
          
        case 'weather_question':
        case 'conversation':
        default:
          apiMessage = { 
            sender: "user", 
            text: userInput 
          };
          break;
      }
      
      // Update UI with original message
      setMessages(prev => [...prev, displayMessage]);
      setInput("");
      
      // Add helper message for general weather questions that need a location
      if (addHelperMessage) {
        setMessages(prev => [
          ...prev,
          { 
            sender: "system", 
            text: "For weather information, I'll need a specific location. Try adding a city name to your question.",
            timestamp: new Date()
          }
        ]);
      }
      
      // Send enhanced message to API
      const messagesToSend = [...messages.filter(msg => msg.sender !== "system"), apiMessage];
      originalSendRequest(messagesToSend);
  } else if (!input.trim()) {
    setMessages([
      ...messages,
      { sender: "system", text: "Message cannot be empty.", timestamp: new Date() },
    ]);
    }
  };

  const clearChat = () => {
    // Generate a new thread ID
    const newThreadId = `thread-${Date.now()}`;
    setThreadId(newThreadId);
    saveThreadId(newThreadId);

    // Reset messages to initial state
    setMessages([
      { 
        sender: "agent", 
        text: "Hello! I'm your weather assistant. You can:\n\n- Type a **city name** like 'New York' or 'Paris'\n- Ask a question like 'What's the weather in Tokyo?'\n- Request a forecast with 'Will it rain in London tomorrow?'\n\nHow can I help you today?",
        timestamp: new Date()
      },
    ]);

    // Clear old thread messages from localStorage
    localStorage.removeItem(`messages_${threadId}`);
  };

  const toggleTheme = () => {
    // Apply a smooth transition effect before changing theme
    document.documentElement.classList.add("theme-transition");
    
    // Toggle the theme
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    
    // Remove the transition class after the change is complete
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 500);
  };

  // Helper function to detect if the agent response indicates a location was not found
  const isLocationNotFoundResponse = (response: string): boolean => {
    const lowerResponse = response.toLowerCase();
    
    // Patterns that indicate the location wasn't found or understood
    const errorPatterns = [
      /couldn't find weather data for/i,
      /i don't have information for/i,
      /i can't find/i,
      /not able to find/i,
      /no data available for/i,
      /don't recognize that location/i,
      /i need a specific location/i,
      /i need a valid city/i
    ];
    
    return errorPatterns.some(pattern => pattern.test(lowerResponse));
  };

  // Function to add a helpful prompt if location wasn't found
  const addLocationHelperPrompt = (currentMessages: Array<{ sender: string; text: string }>) => {
    // Don't add if we already have a helper message recently
    const last3Messages = currentMessages.slice(-3);
    const alreadyHasHelper = last3Messages.some(msg => 
      msg.sender === "system" && msg.text.includes("Try specifying a city"));
    
    if (alreadyHasHelper) return currentMessages;
    
    return [
      ...currentMessages,
      { 
        sender: "system", 
        text: "Try specifying a city name clearly. For example: 'New York', 'London', or 'What's the weather in Tokyo?'" 
      }
    ];
  };

  // Function to detect if a message is a weather question without a location
  const isGeneralWeatherQuestion = (message: string): boolean => {
    const lowerMsg = message.toLowerCase().trim();
    
    // Patterns for general weather questions without locations
    const generalWeatherPatterns = [
      /^is it (going to|gonna) (rain|snow|be sunny|be cloudy)/i,
      /^what'?s the weather( like)?$/i,
      /^how'?s the weather( today)?$/i,
      /^what'?s the temperature( like)?$/i,
      /^(will it|is it) (rain|snow|sunny|cloudy|windy)( today| tomorrow)?$/i,
      /^(what is|tell me) (today'?s|tomorrow'?s|the) forecast$/i,
      /^(what is|tell me) (today'?s|tomorrow'?s|the) temperature$/i
    ];
    
    return generalWeatherPatterns.some(pattern => pattern.test(lowerMsg));
  };

  // Utility function to format timestamp
  const formatTimestamp = (date?: Date): string => {
    if (!date) return '';
    
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  useEffect(() => {
    if (responseChunks.length > 0 && responseChunks[0].trim()) {
      // Check if the response is substantially different or just growing
      const isNewResponse = !responseChunks[0].startsWith(lastResponseRef.current) && 
                          !lastResponseRef.current.startsWith(responseChunks[0]);
      
      // Only update if the response has changed
      if (responseChunks[0] !== lastResponseRef.current) {
        lastResponseRef.current = responseChunks[0];
        
        setMessages(prev => {
          const lastUserMsgIndex = [...prev].reverse().findIndex(msg => msg.sender === "user");
          const lastAgentMsgIndex = [...prev].reverse().findIndex(msg => msg.sender === "agent" && !msg.text.includes("Hello"));
          
          // Check if the response indicates the location wasn't found
          const locationNotFound = isLocationNotFoundResponse(responseChunks[0]);
          
          // If we have a user message and either no agent message or the agent message is before the last user message
          if (lastUserMsgIndex !== -1 && (lastAgentMsgIndex === -1 || lastUserMsgIndex < lastAgentMsgIndex)) {
            // Add new agent message after the user message with timestamp
            let updatedMessages = [
              ...prev,
              { sender: "agent", text: responseChunks[0], timestamp: new Date() }
            ];
            
            // Add a helper message if location wasn't found
            if (locationNotFound) {
              updatedMessages = addLocationHelperPrompt(updatedMessages);
            }
            
            return updatedMessages;
          }
          // If we already have an agent message and are just updating it
          else if (lastAgentMsgIndex !== -1) {
            const reverseIndex = lastAgentMsgIndex;
            const actualIndex = prev.length - 1 - reverseIndex;
            
            const updatedMessages = [...prev];
            updatedMessages[actualIndex] = { 
              sender: "agent", 
              text: responseChunks[0],
              timestamp: new Date()
            };
            
            // Add a helper message if location wasn't found
            if (locationNotFound) {
              return addLocationHelperPrompt(updatedMessages);
            }
            
            return updatedMessages;
          }
          // Fallback - add new agent message
          else if (isNewResponse) {
            let updatedMessages = [
              ...prev,
              { sender: "agent", text: responseChunks[0], timestamp: new Date() }
            ];
            
            // Add a helper message if location wasn't found
            if (locationNotFound) {
              updatedMessages = addLocationHelperPrompt(updatedMessages);
            }
            
            return updatedMessages;
          }
          
          return prev; // No change
        });
      }
    }
  }, [responseChunks, loading]);

  useEffect(() => {
    if (error) {
      setMessages((prev) => [...prev, { 
        sender: "system", 
        text: `Error: ${error}`,
        timestamp: new Date()
      }]);
    }
  }, [error]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  // Enhanced theme toggle with proper class management
  useEffect(() => {
    // Set theme in localStorage
    localStorage.setItem("theme", theme);
    
    // Apply or remove the 'dark' class to the HTML element
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    
    console.log("Theme changed to:", theme);
  }, [theme]);

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen transition-colors duration-300">
      {/* Header with Theme toggle and Clear Chat buttons */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 shadow-sm">
        <div className="flex items-center space-x-2">
          <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Weather Assistant
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={clearChat}
            className="px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 flex items-center space-x-2"
            aria-label="Clear chat history"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>New Chat</span>
          </button>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200"
          >
            {theme === "light" ? (
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Chat history pane */}
      <div
        ref={chatHistoryRef}
        className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 flex flex-col min-h-0"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 p-4 rounded-xl max-w-[80%] ${
              message.sender === "user"
                ? "self-end bg-blue-600 text-white ml-auto shadow-md"
                : message.sender === "agent"
                ? "self-start bg-white text-gray-800 dark:bg-gray-800 dark:text-white agent-message shadow-md border border-gray-200 dark:border-gray-700"
                : "self-start bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 shadow-md border border-amber-200 dark:border-amber-700"
            }`}
          >
            {message.sender === "agent" ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span className="font-medium text-sm text-gray-500 dark:text-gray-400">Weather Assistant</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatTimestamp(message.timestamp)}</span>
                </div>
                <ReactMarkdown components={{
                  p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                  br: () => <br className="block my-2" />,
                  ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-3" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-3" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1" {...props} />,
                  a: ({node, ...props}) => <a className="text-blue-600 dark:text-blue-400 underline" {...props} />
                }}>
                  {message.text.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </>
            ) : message.sender === "system" ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium text-sm text-amber-700 dark:text-amber-300">Tip</span>
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-500">{formatTimestamp(message.timestamp)}</span>
                </div>
                <div className="text-amber-800 dark:text-amber-100">{message.text}</div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-300">{formatTimestamp(message.timestamp)}</span>
                  <span className="font-medium text-sm text-blue-200">You</span>
                </div>
                <div>{message.text}</div>
              </>
            )}
          </div>
        ))}
        {loading && (
          <div className="self-start bg-white text-gray-800 dark:bg-gray-800 dark:text-white p-4 rounded-xl max-w-[80%] shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                <span className="font-medium text-sm text-gray-500 dark:text-gray-400">Weather Assistant</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{formatTimestamp(new Date())}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="animate-bounce h-2 w-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
              <div className="animate-bounce h-2 w-2 bg-blue-500 dark:bg-blue-400 rounded-full" style={{ animationDelay: "0.2s" }}></div>
              <div className="animate-bounce h-2 w-2 bg-blue-500 dark:bg-blue-400 rounded-full" style={{ animationDelay: "0.4s" }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="flex items-center pb-3 mt-4 p-4 bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 shadow-lg sticky bottom-0 z-10">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full py-3 px-4 pl-10 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-inner"
            placeholder="Type a city name or ask about the weather..."
            disabled={loading}
            style={{ minHeight: "48px" }}
          />
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 absolute left-3 top-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
          </svg>
        </div>
        <button
          onClick={sendMessage}
          className={`ml-4 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 shadow-md flex items-center space-x-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={loading}
          style={{ minHeight: "48px" }}
        >
          <span>Send</span>
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
