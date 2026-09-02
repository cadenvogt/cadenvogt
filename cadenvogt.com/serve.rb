#!/usr/bin/env ruby
# Local preview server. Avoids sendfile (EPERM in some sandboxes).
require "webrick"

class WEBrick::HTTPResponse
  def send_body_io(socket)
    while (buf = @body.read(16_384))
      socket.write(buf)
    end
  ensure
    @body.close if @body.respond_to?(:close) && !@body.closed?
  end
end

root = File.expand_path(__dir__)
server = WEBrick::HTTPServer.new(
  Port: 8765,
  BindAddress: "127.0.0.1",
  DocumentRoot: root,
  AccessLog: []
)

trap("INT") { server.shutdown }
trap("TERM") { server.shutdown }

puts "Serving #{root} at http://127.0.0.1:8765/"
server.start
