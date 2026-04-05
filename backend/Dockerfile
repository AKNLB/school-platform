FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=1994

# WeasyPrint/system libs
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  cmake \
  pkg-config \
  libopenblas-dev \
  liblapack-dev \
  libcairo2 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libpangoft2-1.0-0 \
  libgdk-pixbuf-2.0-0 \
  libffi-dev \
  libjpeg62-turbo \
  zlib1g \
  shared-mime-info \
  fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app/

EXPOSE 1994
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "-b", "0.0.0.0:1994", "work:app", "--timeout", "120"]