class ScraperException(Exception):
    """Base exception for all scraper related errors"""
    pass

class FetchError(ScraperException):
    """Raised when fetching a resource fails"""
    pass

class ParseError(ScraperException):
    """Raised when parsing a resource fails"""
    pass

class ValidationError(ScraperException):
    """Raised when validation of parsed data fails"""
    pass
